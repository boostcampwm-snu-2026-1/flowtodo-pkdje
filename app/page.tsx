'use client';

import { ReactFlowProvider } from 'reactflow';
import { Canvas } from './components/Canvas';
import { CreateTaskModal } from './components/CreateTaskModal';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { TaskDrawer } from './components/TaskDrawer';
import { ToastContainer } from './components/ToastContainer';

export default function Home() {
  return (
    <ReactFlowProvider>
      <div className="flex h-screen flex-col">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <Canvas />
          <TaskDrawer />
        </div>
        <CreateTaskModal />
        <ToastContainer />
      </div>
    </ReactFlowProvider>
  );
}
