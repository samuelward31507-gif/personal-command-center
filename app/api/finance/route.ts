import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
function db(){if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is not configured.");return neon(process.env.DATABASE_URL);}
async function userId(){const r=await auth.getSession();return r?.data?.session&&r?.data?.user?.id?String(r.data.user.id):null;}
const fail=(message:string,status:number)=>Response.json({error:message},{status});
const text=(v:unknown,n:number)=>typeof v==="string"?v.trim().slice(0,n):"";
const money=(v:unknown)=>{if(typeof v!=="number"&&typeof v!=="string")return null;if(typeof v==="string"&&!v.trim())return null;const n=Number(v);return Number.isFinite(n)&&n>=0&&n<=9999999999.99?n:null;};
const uuid=(v:unknown):v is string=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const date=(v:unknown)=>{if(v===""||v==null)return null;if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const parsed=new Date(v+"T00:00:00.000Z");return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===v?v:false;};
const revenueTypes=new Set(["setup_fee","monthly_retainer","usage","one_time","other"]);
const revenueStatuses=new Set(["expected","paid","overdue","cancelled"]);
const expenseCategories=new Set(["software","marketing","contractor","telecom","hosting","education","equipment","travel","fees","taxes","other"]);
export async function GET(){
 try{const owner=await userId();if(!owner)return fail("Unauthorized",401);const sql=db();
 const [rev,exp,projectRunRate,contractedRunRate]=await Promise.all([
 sql`SELECT r.id,r.title,r.revenue_type,r.amount,r.status,r.due_date,r.paid_at,r.notes,r.contact_id,r.deal_id,r.project_id,r.created_at,trim(concat_ws(' ',c.first_name,c.last_name)) AS contact_name,d.title AS deal_title,p.name AS project_name FROM public.revenue_entries r LEFT JOIN public.contacts c ON c.id=r.contact_id AND c.owner_id=r.owner_id LEFT JOIN public.deals d ON d.id=r.deal_id AND d.owner_id=r.owner_id LEFT JOIN public.projects p ON p.id=r.project_id AND p.owner_id=r.owner_id WHERE r.owner_id=${owner} ORDER BY CASE WHEN r.status='overdue' THEN 0 WHEN r.status='expected' THEN 1 ELSE 2 END,r.due_date ASC NULLS LAST,r.created_at DESC LIMIT 1000`,
 sql`SELECT id,title,category,amount,expense_date,recurring,notes,created_at FROM public.business_expenses WHERE owner_id=${owner} ORDER BY expense_date DESC,created_at DESC LIMIT 1000`,
 sql`SELECT COALESCE(SUM(monthly_value),0) AS mrr FROM public.projects WHERE owner_id=${owner} AND status IN ('onboarding','in_progress','blocked','review')`,
 sql`SELECT COALESCE(SUM(monthly_fee),0) AS mrr FROM public.deals WHERE owner_id=${owner} AND stage='won' AND agreement_status='active' AND signed_at IS NOT NULL AND (effective_at IS NULL OR effective_at<=CURRENT_DATE) AND (ended_at IS NULL OR ended_at>CURRENT_DATE)`
 ]);
 const now=new Date(),todayKey=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0"),month=todayKey.slice(0,7);
 const dateOnly=(v:unknown):string|null=>v==null?null:v instanceof Date?v.toISOString().slice(0,10):String(v).slice(0,10);
 const revenue=rev.map((r:any)=>{const dueDate=dateOnly(r.due_date),paidAt=dateOnly(r.paid_at);const overdue=r.status==="overdue"||(r.status==="expected"&&dueDate!==null&&dueDate<todayKey);return {...r,amount:Number(r.amount),due_date:dueDate,paid_at:paidAt,status:overdue?"overdue":r.status};});
 const expenses=exp.map((r:any)=>({...r,amount:Number(r.amount),expense_date:dateOnly(r.expense_date)}));
 const paidRevenue=revenue.filter((r:any)=>r.status==="paid"&&r.paid_at?.startsWith(month)).reduce((s:number,r:any)=>s+r.amount,0);
 const setupRevenue=revenue.filter((r:any)=>r.status==="paid"&&r.revenue_type==="setup_fee"&&r.paid_at?.startsWith(month)).reduce((s:number,r:any)=>s+r.amount,0);
 // Invoice records may contain multiple months for the same client; active delivery commitments are the run-rate source.
 const mrr=Number(projectRunRate[0]?.mrr||0);
 const contractedMrr=Number(contractedRunRate[0]?.mrr||0);
 const monthExpenses=expenses.filter((r:any)=>r.expense_date?.startsWith(month)).reduce((s:number,r:any)=>s+r.amount,0);
 const expected=revenue.filter((r:any)=>["expected","overdue"].includes(r.status)).reduce((s:number,r:any)=>s+r.amount,0);
 return Response.json({revenue,expenses,summary:{month,paidRevenue,setupRevenue,mrr,contractedMrr,arr:contractedMrr*12,monthExpenses,monthNet:paidRevenue-monthExpenses,expected,overdue:revenue.filter((r:any)=>r.status==="overdue").reduce((s:number,r:any)=>s+r.amount,0)}})
 }catch(e){console.error("Finance GET failed",e);return fail("Unable to load financial records.",500);}
}
export async function POST(req:Request){
 try{const owner=await userId();if(!owner)return fail("Unauthorized",401);const b=await req.json();const title=text(b.title,240),amountValue=money(b.amount);if(!title)return fail("A title is required.",400);if(amountValue===null)return fail("Amount must be a non-negative number.",400);const sql=db();
 if(b.kind==="expense"){const expenseDate=date(b.date);if(expenseDate===false)return fail("Expense date must use YYYY-MM-DD.",400);if(b.category!==undefined&&!expenseCategories.has(b.category))return fail("Invalid expense category.",400);const category=b.category===undefined?"other":b.category;const rows=await sql`INSERT INTO public.business_expenses(owner_id,title,category,amount,expense_date,recurring,notes) VALUES(${owner},${title},${category},${amountValue},COALESCE(${expenseDate}::date,CURRENT_DATE),${b.recurring===true},${text(b.notes,5000)}) RETURNING id`;return Response.json({id:rows[0]?.id},{status:201});}
 if(b.kind==="revenue"){const due=date(b.dueDate);if(due===false)return fail("Due date must use YYYY-MM-DD.",400);const paid=date(b.paidAt);if(paid===false)return fail("Paid date must use YYYY-MM-DD.",400);if(b.revenueType!==undefined&&!revenueTypes.has(b.revenueType))return fail("Invalid revenue type.",400);if(b.status!==undefined&&!revenueStatuses.has(b.status))return fail("Invalid revenue status.",400);const type=b.revenueType===undefined?"other":b.revenueType,status=b.status===undefined?"expected":b.status;for(const key of ["contactId","dealId","projectId"] as const){const value=b[key];if(value){if(typeof value!=="string"||!/^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(value))return fail("Invalid linked record.",400);const rows=key==="contactId"?await sql`SELECT id FROM public.contacts WHERE id=${value}::uuid AND owner_id=${owner} LIMIT 1`:key==="dealId"?await sql`SELECT id FROM public.deals WHERE id=${value}::uuid AND owner_id=${owner} LIMIT 1`:await sql`SELECT id FROM public.projects WHERE id=${value}::uuid AND owner_id=${owner} LIMIT 1`;if(!rows.length)return fail("Linked record not found in your workspace.",404);}}
 const contact=b.contactId||null,deal=b.dealId||null,project=b.projectId||null;
 const rows=await sql`INSERT INTO public.revenue_entries(owner_id,contact_id,deal_id,project_id,title,revenue_type,amount,status,due_date,paid_at,notes) VALUES(${owner},${contact}::uuid,${deal}::uuid,${project}::uuid,${title},${type},${amountValue},${status},${due}::date,${status==="paid"?(paid||new Date().toISOString().slice(0,10)):null}::date,${text(b.notes,5000)}) RETURNING id`;return Response.json({id:rows[0]?.id},{status:201});}
 return fail("Choose revenue or expense.",400);
 }catch(e){console.error("Finance POST failed",e);return fail("Unable to save financial record.",500);}
}
export async function PATCH(req:Request){
 try{const owner=await userId();if(!owner)return fail("Unauthorized",401);const b=await req.json();if(!uuid(b.id)||!revenueStatuses.has(b.status))return fail("Valid revenue id and status are required.",400);const paid=date(b.paidAt);if(paid===false)return fail("Paid date must use YYYY-MM-DD.",400);const sql=db();const rows=await sql`UPDATE public.revenue_entries SET status=${b.status},paid_at=CASE WHEN ${b.status}='paid' THEN COALESCE(${paid}::date,CURRENT_DATE) ELSE NULL END,updated_at=now() WHERE id=${b.id}::uuid AND owner_id=${owner} RETURNING id`;if(!rows.length)return fail("Revenue record not found.",404);return Response.json({ok:true});}
 catch(e){console.error("Finance PATCH failed",e);return fail("Unable to update revenue status.",500);}
}
export async function DELETE(req:Request){
 try{const owner=await userId();if(!owner)return fail("Unauthorized",401);const u=new URL(req.url),id=u.searchParams.get("id"),kind=u.searchParams.get("kind");if(!uuid(id)||!["revenue","expense"].includes(kind||""))return fail("Valid record id and kind are required.",400);const sql=db();const rows=kind==="revenue"?await sql`DELETE FROM public.revenue_entries WHERE id=${id}::uuid AND owner_id=${owner} RETURNING id`:await sql`DELETE FROM public.business_expenses WHERE id=${id}::uuid AND owner_id=${owner} RETURNING id`;if(!rows.length)return fail("Record not found.",404);return Response.json({ok:true});}
 catch(e){console.error("Finance DELETE failed",e);return fail("Unable to delete financial record.",500);}
}