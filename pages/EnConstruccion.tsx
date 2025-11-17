
import React from 'react';
import { Link } from 'react-router-dom';
import { WrenchScrewdriverIcon } from '@heroicons/react/24/outline';
import { Button } from '../components/ui/Button';

export const EnConstruccion = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <WrenchScrewdriverIcon className="w-24 h-24 text-primary mb-4" />
      <h1 className="text-4xl font-bold mb-2">En Construcción</h1>
      <p className="text-lg text-gray-400 mb-6">
        Esta funcionalidad está en desarrollo y estará disponible próximamente.
      </p>
      <Button onClick={() => window.history.back()}>
        Volver a la página anterior
      </Button>
    </div>
  );
};
