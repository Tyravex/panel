import { api } from '@/shared/api/client';

export const getNotifications = () => api.get('/notifications');
export const markAsRead = (id: number) => api.patch(`/notifications/${id}/read`);