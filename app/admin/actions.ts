"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function verifyAdminPassword(password: string) {
    return password === process.env.ADMIN_PASSWORD;
}

export async function getAdminData() {
    const [{ data: chapters }, { data: materials }, { data: tests }, { data: profiles }] = await Promise.all([
        supabaseAdmin.from("chapters").select("*").order("order_index"),
        supabaseAdmin.from("study_materials").select("*, chapter:chapters(name)").order("created_at", { ascending: false }),
        supabaseAdmin.from("tests").select("*, chapter:chapters(name)").order("created_at", { ascending: false }),
        supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: false })
    ]);
    
    // To get student emails:
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
    
    const students = profiles?.map(s => {
        const authUser = authUsers?.users.find(u => u.id === s.id);
        return { ...s, email: authUser?.email || "" };
    }) || [];

    return {
        chapters: chapters || [],
        materials: materials || [],
        tests: tests || [],
        students
    };
}

export async function createStudentUser(name: string, email: string, password: string) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name }
    });
    if (error) return { success: false, error: error.message };
    
    revalidatePath("/admin/students");
    return { success: true };
}

export async function uploadStudyMaterial(formData: FormData) {
    const file = formData.get("file") as File;
    const title = formData.get("title") as string;
    const type = formData.get("type") as string;
    const chapter_id = formData.get("chapter_id") as string;
    const chapter_name = formData.get("chapter_name") as string;

    if (!file || !title || !type || !chapter_id) return { success: false, error: "Missing fields" };

    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}_${title.replace(/\s+/g, "_")}.${ext}`;
    const filePath = `${chapter_name.replace(/\s+/g, "_")}/${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
        .from("study-material-bucket")
        .upload(filePath, file);

    if (uploadError) return { success: false, error: uploadError.message };

    const { error: dbError } = await supabaseAdmin
        .from("study_materials")
        .insert({
            chapter_id,
            title,
            type,
            file_path: filePath,
            file_size_kb: Math.round(file.size / 1024),
            page_count: 0
        });

    if (dbError) return { success: false, error: dbError.message };

    revalidatePath("/admin/materials");
    return { success: true };
}

export async function deleteStudyMaterial(id: string, filePath: string) {
    await supabaseAdmin.storage.from("study-material-bucket").remove([filePath]);
    await supabaseAdmin.from("study_materials").delete().eq("id", id);
    revalidatePath("/admin/materials");
    return { success: true };
}

export async function toggleTestStatus(id: string, currentStatus: boolean) {
    await supabaseAdmin.from("tests").update({ is_active: !currentStatus }).eq("id", id);
    revalidatePath("/admin/tests");
    return { success: true };
}

export async function deleteTest(id: string) {
    await supabaseAdmin.from("tests").delete().eq("id", id);
    revalidatePath("/admin/tests");
    return { success: true };
}
