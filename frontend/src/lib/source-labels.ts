const sheetLabels: Record<string, string> = {
  "01_Company_Master": "Company reference data",
  "02_Fundamental_Summary": "Fundamental evidence summary",
  "03_Technical_Summary": "Market evidence summary",
  "04_Sector_Context": "Sector context",
  "05_Integrated_Scorecard": "Integrated scores and risk flags",
  "06_Selection_Criteria": "Selection criteria",
  "07_Stock_Selection": "Category selections",
  "08_Final_Recommendation": "Final recommendations",
  "09_Calc_and_Checks": "Weight sensitivity and checks",
  "10_ESG_Analysis": "ESG analysis",
  "AI Analysis Data": "Research input data",
  "Five-Year Trends": "Annual financial observations",
  "Technical Source Data": "Daily market observations",
};

export const sourceLabel = (file: string) => file.replace(/^IA - /, "").replace(/\.xlsx$/i, "");
export const sheetLabel = (sheet: string) => sheetLabels[sheet] ?? sheet.replace(/^\d+[ _-]+/, "").replaceAll("_", " ");
