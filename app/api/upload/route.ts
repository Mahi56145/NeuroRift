import Papa from "papaparse";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
const formData = await req.formData();
const file = formData.get("file") as File;

if (!file) {
return new Response(
JSON.stringify({ error: "No file uploaded" }),
{ status: 400, headers: { "Content-Type": "application/json" } }
);
}

const fileBuffer = await file.arrayBuffer();
const fileName = `${Date.now()}-${file.name}`;

// 🟢 Upload to storage
const { error: uploadError } = await supabase.storage
.from("datasets")
.upload(fileName, fileBuffer, {
contentType: file.type,
});

if (uploadError) {
console.error(uploadError);
return new Response(
JSON.stringify({ error: "Storage upload failed" }),
{ status: 500, headers: { "Content-Type": "application/json" } }
);
}

// 🟢 Get public URL
const { data: publicUrlData } = supabase.storage
.from("datasets")
.getPublicUrl(fileName);

const file_url = publicUrlData.publicUrl;

// 🔴 CHECK FILE TYPE
const isCSV = file.type.includes("csv") || file.name.endsWith(".csv");
const isPDF = file.type.includes("pdf") || file.name.endsWith(".pdf");

let rows: any[] = [];
let columns: string[] = [];

// 🟢 CSV HANDLING
if (isCSV) {
const text = await file.text();

const parsed = Papa.parse(text, {
  header: true,
  skipEmptyLines: true,
});

rows = parsed.data as any[];
columns = Object.keys(rows[0] || {});


}

// 🟢 Save to database (common for all files)
const { data: dbData, error: dbError } = await supabase
.from("datasets")
.insert([
{
name: file.name,
category: isCSV ? "CSV Dataset" : isPDF ? "PDF Document" : "Other",
file_url,
rows_count: rows.length || 0,
columns_count: columns.length || 0,
},
])
.select();

if (dbError) {
console.error(dbError);
return new Response(
JSON.stringify({ error: "DB error" }),
{ status: 500, headers: { "Content-Type": "application/json" } }
);
}

return new Response(
JSON.stringify({
message: "Uploaded successfully",
file_url,
dbData,
preview: rows.slice(0, 5),
type: isCSV ? "csv" : isPDF ? "pdf" : "other",
}),
{ headers: { "Content-Type": "application/json" } }
);
}
