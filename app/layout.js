import './globals.css';
import Providers from './providers';
import AppScaleController from '@/components/AppScaleController';

export const metadata = {
  title: 'Badminton Queue System',
  description: 'C-ONE Sport Center Badminton Queuing',
  icons: {
    icon: '/arrows.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppScaleController />
          {children}
        </Providers>
      </body>
    </html>
  );
}
