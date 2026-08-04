import axios from 'axios'; import { useAuth } from '../store/auth';
export const api=axios.create({baseURL:import.meta.env.VITE_API_URL||'http://localhost:5000/api/v1'});
api.interceptors.request.use(config=>{const token=useAuth.getState().accessToken;if(token)config.headers.Authorization=`Bearer ${token}`;return config});
let refreshing:Promise<string>|null=null;
api.interceptors.response.use(r=>r,async error=>{const original=error.config;if(error.response?.status===401&&!original._retry&&useAuth.getState().refreshToken){original._retry=true;refreshing??=api.post('/auth/refresh',{refreshToken:useAuth.getState().refreshToken}).then(r=>{const token=r.data.data.accessToken;useAuth.getState().setAccessToken(token);return token}).finally(()=>{refreshing=null});try{original.headers.Authorization=`Bearer ${await refreshing}`;return api(original)}catch{useAuth.getState().logout()}}return Promise.reject(error)});
