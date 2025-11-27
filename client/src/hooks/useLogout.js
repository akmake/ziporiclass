import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '@/utils/api.js';
import { useAuthStore } from '@/stores/authStore';

const logoutRequest = async () => {
  await api.post('/auth/logout');
};

const useLogout = () => {
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: logoutRequest,
    onSuccess: () => {
      logout();
      toast.success('התנתקת בהצלחה.');
      navigate('/');
    },
    onError: () => {
      // Even if server fails, log out on client
      logout();
      toast.error('אירעה שגיאה בהתנתקות, אך נוקתה מהמערכת.');
      navigate('/');
    },
  });
};

export default useLogout;