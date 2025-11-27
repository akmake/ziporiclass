import { useMutation } from '@tanstack/react-query';
import api from '@/utils/api.js';

const registerRequest = async (credentials) => {
  // credentials will be an object like { email, password }
  const { data } = await api.post('/auth/register', credentials);
  return data;
};

const useRegister = () => {
  return useMutation({
    mutationFn: registerRequest,
  });
};

export default useRegister;