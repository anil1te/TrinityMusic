import React from 'react';
import { motion } from 'framer-motion';
import { Library, ListMusic, Globe, Users, User } from 'lucide-react';
import { NavLink } from 'react-router-dom';

interface SidebarProps {
  setCurrentView: (view: 'player' | 'auth') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  setCurrentView,
}) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img 
          src="/logo.jpg" 
          alt="Trinity Logo" 
          style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} 
        />
        Trinity
      </div>
      
      <nav className="nav-links">
        <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Library size={24} />
            <span>Все треки</span>
          </motion.div>
        </NavLink>
        <NavLink to="/playlists" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <ListMusic size={24} />
            <span>Мои Плейлисты</span>
          </motion.div>
        </NavLink>
        <NavLink to="/shared" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Globe size={24} />
            <span>Общие Плейлисты</span>
          </motion.div>
        </NavLink>
        <NavLink to="/groups" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Users size={24} />
            <span>Группы</span>
          </motion.div>
        </NavLink>
      </nav>

      <div style={{ marginTop: 'auto' }}>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="nav-item" onClick={() => setCurrentView('auth')}>
          <User size={24} />
          <span>Аккаунт</span>
        </motion.div>
      </div>
    </aside>
  );
};
