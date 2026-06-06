import { Canvas } from './components/Canvas';
import { CreateTaskModal } from './components/CreateTaskModal';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { TaskDrawer } from './components/TaskDrawer';

export default function Home() {
  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <Canvas />
        <TaskDrawer />
      </div>
      <CreateTaskModal />
    </div>
  );
}
