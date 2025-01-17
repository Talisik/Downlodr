import React from 'react';
import useDownloadStore from '../Store/downloadStore';

const History = () => {
  const forDownloads = useDownloadStore((state) => state.forDownloads);

  return (
    <div className="w-full">
      <h1>History</h1>
    </div>
  );
};

export default History;
