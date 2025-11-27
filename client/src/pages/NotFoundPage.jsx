import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button.jsx';
const NotFoundPage = () => {
  return (
    <div className="text-center flex flex-col items-center justify-center h-full">
      <h1 className="text-6xl font-bold text-amber-600">404</h1>
      <p className="text-2xl mt-4 mb-8">אופס! העמוד שחיפשת לא נמצא.</p>
      <Button asChild>
        <Link to="/">חזור לדף הבית</Link>
      </Button>
    </div>
  );
};

export default NotFoundPage;