import React from 'react';
import { Outlet } from 'react-router-dom';
import { AdminSidebar } from '../components/admin/AdminSidebar';
import { BackButton } from '../components/ui/BackButton';

export const AdminLayout = () => {
  return (
    <div className="flex min-h-screen bg-base-100 text-gray-200">
      <AdminSidebar />
      <main className="flex-1 p-8 overflow-y-auto ml-64">
        <div className="mb-6">
          <BackButton />
        </div>
        <Outlet />
      </main>
    </div>
  );
};
