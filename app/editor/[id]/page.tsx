import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "../../lib/db";
import { getCurrentUser } from "../../lib/auth";
import EditorWorkspace from "./EditorWorkspace";

export const metadata: Metadata = {
  title: "Editor",
};

export default async function EditorDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const [doc, projects] = await Promise.all([
    prisma.document.findFirst({
      where: { id, userId: user.id, deletedAt: null },
    }),
    prisma.project.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!doc) notFound();

  const content = doc.content as { doc: unknown; html: string } | null;
  const initialHtml =
    content?.html ??
    (doc.improvedText || doc.originalText
      ? `<p>${(doc.improvedText || doc.originalText).replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</p>`
      : "<p></p>");

  return (
    <EditorWorkspace
      docId={doc.id}
      initialTitle={doc.title}
      initialHtml={initialHtml}
      sourceFormat={doc.sourceFormat}
      projects={projects}
      currentProjectId={doc.projectId}
    />
  );
}
