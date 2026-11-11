"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type ChangeEvent, type FormEvent } from "react";
import { SessionReady, usePatientSession } from "@/components/patient/PatientSession";
import { Field, describedBy } from "@/components/ui/Field";
import { TextField } from "@/components/ui/TextField";
import { DOCUMENT_TYPES, errorCode, formatBytes, MAX_DOCUMENT_BYTES } from "@/lib/patient/record";
import { orNull } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { checkErrors, FormFrame, MentalHealthSwitch, SaveButton, type FieldErrors } from "../../../_components/forms/FormBits";
import { SubScreen } from "../../../_components/Screens";

type DocType = (typeof DOCUMENT_TYPES)[number];

const TYPE_WORDS: Record<DocType, string> = { "application/pdf": "PDF", "image/jpeg": "JPEG", "image/png": "PNG" };

/** The file's real type from its first bytes (the database checks the same), or null. */
async function sniff(file: File): Promise<DocType | null> {
  const b = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return "application/pdf";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return "image/png";
  return null;
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Upload a document (no board; the owner's Documents decision and BRIEF.md
 * section 7): a focused flow, no tab bar, the button pinned at the bottom.
 *
 * The limits are on the screen before anything is sent: PDF, JPEG or PNG,
 * 3 MB a file (and, on a demo, 5 files and 3 MB in all). The file is checked
 * here by its size and its first bytes, so a wrong file is refused in plain
 * words before the upload; the database checks both again and enforces the
 * account limits.
 */
function UploadScreen() {
  const formId = useId();
  const router = useRouter();
  const { isAnonymous } = usePatientSession();
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<DocType | null>(null);
  const [title, setTitle] = useState("");
  const [day, setDay] = useState("");
  const [mental, setMental] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const ids = { file: `${formId}-file`, title: `${formId}-title` };
  const hint = isAnonymous
    ? "PDF, JPEG or PNG, up to 3 MB. The demo keeps up to 5 files, 3 MB in all."
    : "PDF, JPEG or PNG, up to 3 MB.";

  async function choose(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setType(null);
    setSaveError(null);
    if (!f) return;
    const real = await sniff(f);
    setType(real);
    let problem: string | undefined;
    if (!real) problem = `${f.name} isn't a PDF, JPEG or PNG. Choose one of those.`;
    else if (f.size > MAX_DOCUMENT_BYTES) problem = `${f.name} is ${formatBytes(f.size)}. Choose a file of 3 MB or less.`;
    else if (f.size === 0) problem = `${f.name} is empty. Choose another file.`;
    setErrors((x) => ({ ...x, file: problem }));
    if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, "").slice(0, 200));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: FieldErrors = {
      file: !file ? "Choose a file to upload." : errors.file,
      title: title.trim() ? undefined : "Give the document a name, like Discharge letter.",
    };
    setErrors(next);
    if (!checkErrors(next, ids) || !file || !type) return;
    setBusy(true);
    setSaveError(null);
    let data: string;
    try {
      data = await toBase64(file);
    } catch {
      setBusy(false);
      setSaveError("This file couldn't be read. Choose it again.");
      return;
    }
    const { error } = await createClient().rpc("upload_document", {
      title: title.trim(),
      content_type: type,
      data_base64: data,
      document_date: orNull(day) ?? undefined,
      is_mental_health: mental,
    });
    if (error) {
      setBusy(false);
      const code = errorCode(error);
      if (code === "file_too_large") setErrors({ file: "This file is over 3 MB. Choose a smaller one." });
      else if (code === "invalid_type" || code === "type_mismatch" || code === "invalid_file")
        setErrors({ file: "This file isn't a PDF, JPEG or PNG Trace can read. Choose another." });
      else if (code === "quota_exceeded")
        setSaveError(
          isAnonymous
            ? "The demo keeps up to 5 files, 3 MB in all. Delete a document to make room."
            : "Your account's document space is full (100 files, 20 MB in all). Delete a document to make room.",
        );
      else if (code === "storage_full") setSaveError("The demo's shared space for documents is full. Try again tomorrow.");
      else setSaveError("This couldn't be uploaded. Check your connection and try again.");
      return;
    }
    router.push("/profile/documents");
  }

  return (
    <SubScreen
      title="Upload a document"
      titleSize="md"
      backHref="/profile/documents"
      backLabel="Back to Documents"
      footer={<SaveButton form={formId} busy={busy}>Upload</SaveButton>}
    >
      <FormFrame id={formId} onSubmit={submit} error={saveError}>
        <Field id={ids.file} label="File" hint={hint} error={errors.file}>
          <input
            id={ids.file}
            type="file"
            accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
            onChange={choose}
            aria-describedby={describedBy(ids.file, hint, errors.file)}
            aria-invalid={errors.file ? true : undefined}
            className="w-full text-caption text-ink-2 file:mr-3 file:h-11 file:cursor-pointer file:rounded-button file:border file:border-solid file:border-border-control file:bg-surface file:px-4 file:text-label file:font-semibold file:text-accent"
          />
        </Field>
        {file && !errors.file && type && (
          <p className="text-caption text-ink-2">
            {TYPE_WORDS[type]}, {formatBytes(file.size)}
          </p>
        )}
        <TextField id={ids.title} label="Name" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Discharge letter" maxLength={200} error={errors.title} />
        <TextField label="Date on the document" optional type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        <MentalHealthSwitch checked={mental} onChange={setMental} />
      </FormFrame>
    </SubScreen>
  );
}

export default function UploadPage() {
  return (
    <SessionReady>
      <UploadScreen />
    </SessionReady>
  );
}
