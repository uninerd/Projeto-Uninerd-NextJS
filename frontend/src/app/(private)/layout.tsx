import Layout from '@/ui/components/Layout';
import PrivateRoute from '@/ui/components/PrivateRoute';
export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return <PrivateRoute><Layout>{children}</Layout></PrivateRoute>;
}
