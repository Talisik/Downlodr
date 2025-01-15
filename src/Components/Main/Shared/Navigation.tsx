import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { HiChevronDown, HiChevronRight } from 'react-icons/hi';
import { FiDownload, FiClock } from 'react-icons/fi';
import { AiOutlineCheck } from 'react-icons/ai';
import { BiLayer } from 'react-icons/bi';
import { BsTag } from 'react-icons/bs';
import { CiFolderOn } from 'react-icons/ci';

const Navigation = ({ className }: { className?: string }) => {
  const [openSections, setOpenSections] = useState({
    status: true,
    category: true,
    tag: true,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <nav className={`${className} border-solid border-r-2 border-gray-200`}>
      <div className="p-2 space-y-2 ml-2">
        {/* Status Section */}
        <div>
          <button
            onClick={() => toggleSection('status')}
            className="w-full flex items-center p-2 hover:bg-gray-200 rounded"
          >
            {openSections.status ? (
              <HiChevronDown size={18} />
            ) : (
              <HiChevronRight size={18} />
            )}
            <span className="ml-2 text-sm font-semibold">Status</span>
          </button>

          {openSections.status && (
            <div className="ml-4 space-y-1">
              <NavLink to="/allDownloads" className="nav-link">
                <CiFolderOn className="text-gray-600 text-lg flex-shrink-0" />
                <span className="ml-2 ">All</span>
              </NavLink>
              <NavLink to="/downloading" className="nav-link">
                <FiDownload className="text-blue-500 text-lg flex-shrink-0" />
                <span className="ml-2">Downloading</span>
              </NavLink>
              <NavLink to="/completed" className="nav-link">
                <AiOutlineCheck className="text-green-500 text-lg flex-shrink-0" />
                <span className="ml-2">Completed</span>
              </NavLink>
              <NavLink to="/history" className="nav-link">
                <FiClock className="text-yellow-500 text-lg flex-shrink-0" />
                <span className="ml-2">History</span>
              </NavLink>
            </div>
          )}
        </div>

        {/* Category Section */}
        <div>
          <button
            onClick={() => toggleSection('category')}
            className="w-full flex items-center p-2 hover:bg-gray-200 rounded"
          >
            {openSections.category ? (
              <HiChevronDown size={18} />
            ) : (
              <HiChevronRight size={18} />
            )}
            <span className="ml-2 text-sm font-semibold">Category</span>
          </button>

          {openSections.category && (
            <div className="ml-4 space-y-1">
              <NavLink to="/category/all" className="nav-link">
                <BiLayer className="text-orange-500 text-lg flex-shrink-0" />
                <span className="ml-2">All</span>
              </NavLink>
              <NavLink to="/category/uncategorized" className="nav-link">
                <BiLayer className="text-blue-500 text-lg flex-shrink-0" />
                <span className="ml-2">Uncategorized</span>
              </NavLink>
              <NavLink to="/category/1" className="nav-link">
                <BiLayer className="text-yellow-500 text-lg flex-shrink-0" />
                <span className="ml-2">Category 1</span>
              </NavLink>
            </div>
          )}
        </div>

        {/* Tag Section */}
        <div>
          <button
            onClick={() => toggleSection('tag')}
            className="w-full flex items-center p-2 hover:bg-gray-200 rounded"
          >
            {openSections.tag ? (
              <HiChevronDown size={18} />
            ) : (
              <HiChevronRight size={18} />
            )}
            <span className="ml-2 text-sm font-semibold">Tag</span>
          </button>

          {openSections.tag && (
            <div className="ml-4 space-y-1">
              <NavLink to="/tags/all" className="nav-link">
                <BsTag className="text-orange-500 text-lg flex-shrink-0" />
                <span className="ml-2">All</span>
              </NavLink>
              <NavLink to="/tags/untagged" className="nav-link">
                <BsTag className="text-blue-500 text-lg flex-shrink-0" />
                <span className="ml-2">Untagged</span>
              </NavLink>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
