import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './Layout/MainLayout';

export const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          {/* Add your child routes here */}
          <Route index element={<div className="p-4">Main Content Area</div>} />
          <Route path="downloads" element={<div className="p-4">Downloads Page</div>} />
          <Route path="completed" element={<div className="p-4">Completed Page</div>} />
          <Route path="settings" element={<div className="p-4">Settings Page</div>} />
        </Route>
      </Routes>
    </Router>
  );
};