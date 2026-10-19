const Stop = ({ className }: { className?: string }) => {
  return (
    <svg
      className={className}
      width="11"
      height="12"
      viewBox="0 0 11 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0 11.5V0.5H11V11.5H0ZM1.5 10H9.5V2H1.5V10Z"
        fill="currentColor"
      />
    </svg>
  );
};
export default Stop;
