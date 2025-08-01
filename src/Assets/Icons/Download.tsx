const Download = ({ className }: { className?: string }) => {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8 11.7885L3.73075 7.51925L4.78475 6.43475L7.25 8.9V0.5H8.75V8.9L11.2153 6.43475L12.2693 7.51925L8 11.7885ZM2.30775 15.5C1.80258 15.5 1.375 15.325 1.025 14.975C0.675 14.625 0.5 14.1974 0.5 13.6923V10.9808H2V13.6923C2 13.7692 2.03208 13.8398 2.09625 13.9038C2.16025 13.9679 2.23075 14 2.30775 14H13.6923C13.7692 14 13.8398 13.9679 13.9038 13.9038C13.9679 13.8398 14 13.7692 14 13.6923V10.9808H15.5V13.6923C15.5 14.1974 15.325 14.625 14.975 14.975C14.625 15.325 14.1974 15.5 13.6923 15.5H2.30775Z"
        fill="currentColor"
      />
    </svg>
  );
};

export default Download;
