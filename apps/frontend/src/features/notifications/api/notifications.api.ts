import { api } from '@/app/api/axios';

export const getNotifications = () => api.get('/notifications');
export const markAsRead = (id: number) => api.patch(`/notifications/${id}/read`);