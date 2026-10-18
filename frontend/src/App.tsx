import { useState } from 'react';
import { Route, Routes } from 'react-router';
import Header from './components/Header';
import Footer from './components/Footer';
import Avatar from './components/Avatar/Avatar';
import Documents from './pages/Documents/Documents';
import Document from './pages/Document/Document';
import Plan from './components/Plan/Plan';
import Reset from './components/Reset/Reset';
import lawyers from './data/lawyers.json';

export default function App() {
  const [currentLawyerId, setCurrentLawyerId] = useState(lawyers[0].id);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Header>
        <div className="flex items-center gap-6">
          <Reset />
          <Plan />
          <Avatar lawyers={lawyers} selectedId={currentLawyerId} onSelect={setCurrentLawyerId} />
        </div>
      </Header>
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Documents />} />
          <Route path="/documents/:id" element={<Document currentLawyerId={currentLawyerId} />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
