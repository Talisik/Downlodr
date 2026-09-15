# Character Error Rate of an SRT against the YouTube reference.
# Japanese has no word boundaries, so CER is the standard metric, not WER.
import re
import sys
import unicodedata

FURIGANA = re.compile(r'[（(][ぁ-ん]+[）)]')


def _secs(ts):
    h, m, s = ts.replace(',', '.').split(':')
    return int(h) * 3600 + int(m) * 60 + float(s)


def cues(path, until=None):
    """Cue texts, optionally only those starting before `until` seconds.

    The reference only covers part of the audio that was fed to the engines, so
    scoring the whole hypothesis would charge every engine for transcribing a
    stretch the ground truth says nothing about.
    """
    out = []
    for block in open(path, encoding='utf-8-sig', errors='replace').read().strip().split('\n\n'):
        lines = block.splitlines()
        if len(lines) < 3 or '-->' not in lines[1]:
            continue
        start = _secs(lines[1].split('-->')[0].strip())
        if until is not None and start >= until:
            continue
        out.extend(l.strip() for l in lines[2:] if l.strip())
    return out


def norm(s, is_ref):
    if is_ref:
        s = FURIGANA.sub('', s)          # reading aids are printed, never spoken
    s = unicodedata.normalize('NFKC', s)  # ２３０ -> 230, ！ -> !
    # Keep only characters that carry spoken content.
    return ''.join(c for c in s if not c.isspace()
                   and unicodedata.category(c)[0] not in ('P', 'S'))


def levenshtein(a, b):
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


# Score only up to where the reference actually covers the audio. Passing the
# wrong value here is what produced a bogus 179% CER earlier: 180s of audio was
# scored against a reference that stopped at 129s, charging every engine for
# transcribing a stretch the ground truth said nothing about.
REF_END = float(sys.argv[1])

ref = norm(''.join(cues(sys.argv[2], until=REF_END)), True)
print(f'{"config":<20} {"CER":>7} {"chars":>6} {"edits":>6}   {"cues":>5} {"uniq":>5}  past-ref')
print('-' * 72)
for path in sys.argv[3:]:
    scored = cues(path, until=REF_END)
    hyp = norm(''.join(scored), False)
    d = levenshtein(ref, hyp)
    beyond = len(cues(path)) - len(scored)
    name = path.rsplit('/', 1)[-1].replace('.srt', '')
    print(f'{name:<20} {d / len(ref):>7.1%} {len(hyp):>6} {d:>6}   '
          f'{len(scored):>5} {len(set(scored)):>5}  {beyond:>5} cues')
print(f'\nreference: {len(ref)} chars, scored over 0-{REF_END}s')
