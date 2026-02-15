export interface GeneratedReport {
  id: string;
  report_id: string;        // FK to reports collection
  pdf_url: string;           // Firebase Storage download URL
  generated_at: number;      // timestamp
  generated_by: string;      // admin user_id who triggered generation
}
