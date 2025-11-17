import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/client/Navbar';

export const ClientLayout = () => {
  return (
    <div className="min-h-screen bg-base-100">
      <Navbar />
      <main>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
