"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { SessionReady, usePatientSession } from "@/components/patient/PatientSession";
import { Field, describedBy } from "@/components/ui/Field";
import { TextField } from "@/components/ui/TextField";
import { DOCUMENT_TYPES, errorCode, formatBytes, MAX_DOCUMENT_BYTES } from "@/lib/patient/record";
import { orNull } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import {
  checkErrors,
  FormFrame,
  MentalHealthSwitch,
  SaveButton,
  useFormScreen,
  type FieldErrors,
  type FormControl,
} from "../../../_components/forms/FormBits";
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

/** The longest side a photo is scaled to when it is over the limit. */
const MAX_SIDE = 2400;

/**
 * A photo over 3 MB (most phone photos are) is scaled down in the browser and
 * saved as a JPEG, so it fits. Returns the file unchanged when it already
 * fits or is not a photo, or null when it can't be made small enough.
 */
async function fitImage(file: File, type: DocType): Promise<{ file: Blob; type: DocType } | null> {
  if (file.size <= MAX_DOCUMENT_BYTES) return { file, type };
  if (type === "application/pdf") return null;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  for (const side of [MAX_SIDE, 1800, 1400]) {
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // A PNG may be transparent: JPEG has no transparency, so start from white.
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (blob && blob.size <= MAX_DOCUMENT_BYTES) {
      bitmap.close();
      return { file: blob, type: "image/jpeg" };
    }
  }
  bitmap.close();
  return null;
}

function toBase64(file: Blob): Promise<string> {
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
  const { formId, busy, formKey, control } = useFormScreen();
  return (
    <SubScreen
      title="Upload a document"
      titleSize="md"
      backHref="/profile/documents"
      backLabel="Back to Documents"
      footer={
        <SaveButton form={formId} busy={busy}>
          Upload
        </SaveButton>
      }
    >
      <UploadForm key={formKey} {...control} />
    </SubScreen>
  );
}

function UploadForm({ formId, onSaving, onSaved }: FormControl) {
  const { isAnonymous } = usePatientSession();
  const [file, setFile] = useState<File | null>(null);
  // The bytes to send: the file itself, or a photo scaled down to fit.
  const [ready, setReady] = useState<{ file: Blob; type: DocType } | null>(null);
  const [title, setTitle] = useState("");
  // The name the last chosen file filled in; a name the patient typed is never replaced.
  const [autoTitle, setAutoTitle] = useState("");
  const [day, setDay] = useState("");
  const [mental, setMental] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const ids = { file: `${formId}-file`, title: `${formId}-title` };
  const hint = isAnonymous
    ? "PDF, JPEG or PNG. A PDF can be up to 3 MB; larger photos are made smaller. The demo keeps up to 5 files, 3 MB in all."
    : "PDF, JPEG or PNG. A PDF can be up to 3 MB; larger photos are made smaller.";

  async function choose(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setReady(null);
    setSaveError(null);
    if (!f) return;
    const real = await sniff(f);
    let problem: string | undefined;
    if (!real) problem = `${f.name} isn't a PDF, JPEG or PNG. Choose one of those.`;
    else if (f.size === 0) problem = `${f.name} is empty. Choose another file.`;
    else {
      const fitted = await fitImage(f, real);
      if (fitted) setReady(fitted);
      else problem = `${f.name} is ${formatBytes(f.size)}. Choose a file of 3 MB or less.`;
    }
    setErrors((x) => ({ ...x, file: problem }));
    if (!title.trim() || title === autoTitle) {
      const fromName = f.name.replace(/\.[^.]+$/, "").slice(0, 200);
      setTitle(fromName);
      setAutoTitle(fromName);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: FieldErrors = {
      file: !file ? "Choose a file to upload." : errors.file,
      title: title.trim() ? undefined : "Give the document a name, like Discharge letter.",
    };
    setErrors(next);
    if (!checkErrors(next, ids) || !file || !ready) return;
    onSaving(true);
    setSaveError(null);
    let data: string;
    try {
      data = await toBase64(ready.file);
    } catch {
      onSaving(false);
      setSaveError("This file couldn't be read. Choose it again.");
      return;
    }
    const { error } = await createClient().rpc("upload_document", {
      title: title.trim(),
      content_type: ready.type,
      data_base64: data,
      document_date: orNull(day) ?? undefined,
      is_mental_health: mental,
    });
    if (error) {
      onSaving(false);
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
    onSaved("/profile/documents");
  }

  return (
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
      {file && !errors.file && ready && (
        <p className="text-caption text-ink-2">
          {TYPE_WORDS[ready.type]}, {formatBytes(ready.file.size)}
          {ready.file !== file ? `, made smaller from ${formatBytes(file.size)}` : ""}
        </p>
      )}
      <TextField
        id={ids.title}
        label="Name"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Discharge letter"
        maxLength={200}
        error={errors.title}
      />
      <TextField label="Date on the document" optional type="date" value={day} onChange={(e) => setDay(e.target.value)} />
      <MentalHealthSwitch checked={mental} onChange={setMental} />
    </FormFrame>
  );
}

export default function UploadPage() {
  return (
    <SessionReady>
      <UploadScreen />
    </SessionReady>
  );
}
