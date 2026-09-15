const EmptySearch = ({ className }: { className?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="8.5" y1="8.5" x2="13.5" y2="13.5" />
      <line x1="13.5" y1="8.5" x2="8.5" y2="13.5" />
    </svg>
  );
};

export default EmptySearch;
