import { useMutation } from '@tanstack/react-query';
import api from '@/utils/api.js';
import { useAuthStore } from '@/stores/authStore';

const loginRequest = async (credentials) => {
  const { data } = await api.post('/auth/login', credentials);
  return data.user;
};

const useLogin = () => {
  const login = useAuthStore((state) => state.login);

  return useMutation({
    mutationFn: loginRequest,
    onSuccess: (user) => {
      login(user);
    },
  });
};

export default useLogin;