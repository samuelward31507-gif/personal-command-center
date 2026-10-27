import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
function db(){if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is not configured.");return neon(process.env.DATABASE_URL);}
function error(message:string,status:number){return Response.json({error:message},{status});}
export async function POST(request:Request){
 try{
  const result=await auth.getSession(),user=result?.data?.session&&result?.data?.user?.id?{id:String(result.data.user.id)}:null;
  if(!user)return error("Unauthorized",401);
  const body=await request.json();
  if(typeof body.projectId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.projectId))return error("Valid project id is required.",400);
  const sql=db();
  const projects=await sql`SELECT id,name,contact_id,deal_id,status FROM public.projects WHERE id=${body.projectId}::uuid AND owner_id=${user.id} LIMIT 1`;
  if(!projects.length)return error("Project not found.",404);
  const project=projects[0] as Record<string,unknown>;
  if(["completed","cancelled"].includes(String(project.status)))return error("Reopen the project before creating tasks from its milestones.",409);
  const milestones=await sql`SELECT id,title,description,status,due_at FROM public.project_milestones WHERE project_id=${body.projectId}::uuid AND owner_id=${user.id} AND status NOT IN ('done','cancelled') ORDER BY sort_order,created_at`;
  let created=0,skipped=0;
  for(const item of milestones as Record<string,unknown>[]){
   const marker="[project-milestone:"+String(item.id)+"]";
   const title=String(item.title||"").trim().slice(0,240);
   const description=[String(item.description||"").trim().slice(0,4000),marker,"Project: "+String(project.name||"").slice(0,240)].filter(Boolean).join("\n\n").slice(0,5000);
   const existing=await sql`SELECT id FROM public.tasks WHERE owner_id=${user.id} AND description LIKE ${"%"+marker+"%"} LIMIT 1`;
   if(existing.length){skipped++;continue;}
   await sql`INSERT INTO public.tasks(owner_id,title,description,status,priority,due_at,contact_id,deal_id) VALUES(${user.id},${title},${description},'todo',CASE WHEN ${item.status}='blocked' THEN 'urgent' ELSE 'medium' END,${item.due_at}::timestamptz,${project.contact_id}::uuid,${project.deal_id}::uuid)`;
   created++;
  }
  return Response.json({ok:true,created,skipped,total:milestones.length});
 }catch(e){console.error("Milestone task handoff failed",e);return error("Unable to create tasks from project milestones.",500);}
}
