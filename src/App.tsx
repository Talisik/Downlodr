import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './Layout/MainLayout';
import Downloading from './Pages/Downloading';
import AllDownloads from './Pages/AllDownloads';
import History from './Pages/History';
import CompletedDownloads from './Pages/CompletedDownloads';
import ScheduleTable from './Pages/Scheduler/ScheduleTable';
import ScheduleCalendar from './Pages/Scheduler/ScheduleCalendar';
export const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Downloading />} />
          <Route path="/downloading" element={<Downloading />} />
          <Route path="/allDownloads" element={<AllDownloads />} />
          <Route path="/completed" element={<CompletedDownloads />} />
          <Route path="/history" element={<History />} />
          <Route path="/scheduleTable" element={<ScheduleTable />} />
          <Route path="/scheduleCalendar" element={<ScheduleCalendar />} />
        </Route>
      </Routes>
    </Router>
  );
};
