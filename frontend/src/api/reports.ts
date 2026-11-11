import api from './client';
import type { DashboardData } from '../types';

export interface PeriodSummary {
  date: string;
  transaction_count: number;
  total_revenue: string;
  total_tax: string;
  total_cost: string;
  gross_profit: string;
  profit_margin: string;
}

export interface ProfitReport {
  summary: PeriodSummary[];
  date_from: string;
  date_to: string;
}

export const getDashboard = async (): Promise<DashboardData> => {
  const res = await api.get<DashboardData>('/reports/dashboard');
  return res.data;
};

export const getDailyProfit = async (reportDate: string): Promise<ProfitReport> => {
  const res = await api.get<ProfitReport>('/reports/daily', { params: { report_date: reportDate } });
  return res.data;
};

export const getMonthlyProfit = async (year: number, month: number): Promise<ProfitReport> => {
  const res = await api.get<ProfitReport>('/reports/monthly', { params: { year, month } });
  return res.data;
};

export const getRangeProfit = async (dateFrom: string, dateTo: string): Promise<ProfitReport> => {
  const res = await api.get<ProfitReport>('/reports/range', { params: { date_from: dateFrom, date_to: dateTo } });
  return res.data;
};

const downloadFile = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const downloadDailyPDF = async (date: string) => {
  const res = await api.get('/reports/daily/pdf', { params: { report_date: date }, responseType: 'blob' });
  downloadFile(res.data, `reporte_${date}.pdf`);
};

export const downloadDailyDOCX = async (date: string) => {
  const res = await api.get('/reports/daily/docx', { params: { report_date: date }, responseType: 'blob' });
  downloadFile(res.data, `reporte_${date}.docx`);
};

export const downloadMonthlyPDF = async (year: number, month: number) => {
  const res = await api.get('/reports/monthly/pdf', { params: { year, month }, responseType: 'blob' });
  downloadFile(res.data, `reporte_${year}_${String(month).padStart(2, '0')}.pdf`);
};

export const downloadMonthlyDOCX = async (year: number, month: number) => {
  const res = await api.get('/reports/monthly/docx', { params: { year, month }, responseType: 'blob' });
  downloadFile(res.data, `reporte_${year}_${String(month).padStart(2, '0')}.docx`);
};

export const downloadRangePDF = async (dateFrom: string, dateTo: string) => {
  const res = await api.get('/reports/range/pdf', { params: { date_from: dateFrom, date_to: dateTo }, responseType: 'blob' });
  downloadFile(res.data, `reporte_${dateFrom}_${dateTo}.pdf`);
};

export const downloadRangeDOCX = async (dateFrom: string, dateTo: string) => {
  const res = await api.get('/reports/range/docx', { params: { date_from: dateFrom, date_to: dateTo }, responseType: 'blob' });
  downloadFile(res.data, `reporte_${dateFrom}_${dateTo}.docx`);
};
