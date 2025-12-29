import { storage } from "../storage";

export type JobStatus = "queued" | "running" | "retrying" | "completed" | "failed";

export interface JobRecord {
  id: string;
  type: string;
  status: JobStatus;
  payload: any;
  result?: any;
  error?: string;
  retries: number;
  maxRetries: number;
  therapistId?: string;
  isDead?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type JobHandler = (job: JobRecord) => Promise<any>;

const jobs = new Map<string, JobRecord>();
const queue: { job: JobRecord; handler: JobHandler }[] = [];
const handlers = new Map<string, JobHandler>();
let isProcessing = false;

function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function registerJobHandler(type: string, handler: JobHandler) {
  handlers.set(type, handler);
}

export async function enqueueJob(
  type: string,
  payload: any,
  handler?: JobHandler,
  therapistId?: string,
  maxRetries = 2
): Promise<JobRecord> {
  const resolvedHandler = handler || handlers.get(type);
  if (!resolvedHandler) {
    throw new Error(`No handler registered for job type: ${type}`);
  }

  const job: JobRecord = {
    id: generateJobId(),
    type,
    status: "queued",
    payload,
    retries: 0,
    maxRetries,
    therapistId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  jobs.set(job.id, job);
  queue.push({ job, handler: resolvedHandler });
  await storage.createJobRun({
    id: job.id,
    type: job.type,
    status: job.status,
    payload: job.payload,
    retries: job.retries,
    maxRetries: job.maxRetries,
    therapistId: job.therapistId,
  });
  processQueue().catch((error) => {
    console.error("[JOB_QUEUE] Failed to process queue:", error);
  });

  return job;
}

export async function getJob(jobId: string): Promise<JobRecord | undefined> {
  const record = await storage.getJobRun(jobId);
  if (!record) return undefined;
  return {
    id: record.id,
    type: record.type,
    status: record.status as JobStatus,
    payload: record.payload,
    result: record.result,
    error: record.error || undefined,
    retries: record.retries || 0,
    maxRetries: record.maxRetries || 0,
    therapistId: record.therapistId || undefined,
    isDead: record.isDead || false,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function listJobs(limit = 50, therapistId?: string): Promise<JobRecord[]> {
  const runs = await storage.getJobRuns(limit, therapistId);
  return runs.map((record) => ({
    id: record.id,
    type: record.type,
    status: record.status as JobStatus,
    payload: record.payload,
    result: record.result,
    error: record.error || undefined,
    retries: record.retries || 0,
    maxRetries: record.maxRetries || 0,
    therapistId: record.therapistId || undefined,
    isDead: record.isDead || false,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }));
}

export async function retryJob(jobId: string): Promise<JobRecord> {
  const record = await getJob(jobId);
  if (!record) {
    throw new Error("Job not found");
  }

  const handler = handlers.get(record.type);
  if (!handler) {
    throw new Error(`No handler registered for job type: ${record.type}`);
  }

  const resetJob: JobRecord = {
    ...record,
    status: "queued",
    error: undefined,
    retries: 0,
    updatedAt: new Date(),
  };

  jobs.set(resetJob.id, resetJob);
  queue.push({ job: resetJob, handler });
  await storage.updateJobRun(resetJob.id, {
    status: resetJob.status,
    error: null,
    retries: resetJob.retries,
    isDead: false,
  });
  processQueue().catch((error) => {
    console.error("[JOB_QUEUE] Failed to process queue:", error);
  });

  return resetJob;
}

async function processQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) {
      continue;
    }

    const { job, handler } = item;
    job.status = "running";
    job.updatedAt = new Date();
    await storage.updateJobRun(job.id, { status: job.status });

    try {
      const result = await handler(job);
      job.status = "completed";
      job.result = result;
      job.updatedAt = new Date();
      await storage.updateJobRun(job.id, {
        status: job.status,
        result: job.result,
        error: null,
      });
    } catch (error: any) {
      job.retries += 1;
      if (job.retries <= job.maxRetries) {
        job.status = "retrying";
        job.error = error?.message || String(error);
        job.updatedAt = new Date();
        await storage.updateJobRun(job.id, {
          status: job.status,
          error: job.error,
          retries: job.retries,
        });
        queue.push(item);
      } else {
        job.status = "failed";
        job.isDead = true;
        job.error = error?.message || String(error);
        job.updatedAt = new Date();
        await storage.updateJobRun(job.id, {
          status: job.status,
          error: job.error,
          retries: job.retries,
          isDead: true,
        });
      }
    }
  }

  isProcessing = false;
}
