/**
 * Memory Permission System
 * 
 * Controls cross-agent memory visibility. Agents can grant read access
 * to their memory files to other agents.
 */

import path from "path";
import { DATA_DIR } from "@/lib/storage/path-utils";
import { readFileContent, writeFileContent, fileExists, ensureDirectory } from "@/lib/storage/fs-operations";

const PERMISSIONS_DIR = path.join(DATA_DIR, ".agents", ".permissions");

export interface MemoryPermission {
  slug: string; // Agent whose memory is being shared
  readableBy: string[]; // Agents who can read this memory
  writableBy: string[]; // Agents who can write to this memory
  public: boolean; // Whether all agents can read
  updatedAt: string;
}

/**
 * Get permissions for an agent's memory
 */
export async function getMemoryPermissions(slug: string): Promise<MemoryPermission> {
  const permPath = path.join(PERMISSIONS_DIR, `${slug}.json`);
  
  try {
    if (await fileExists(permPath)) {
      const content = await readFileContent(permPath);
      return JSON.parse(content);
    }
  } catch (error) {
    console.error(`Failed to read permissions for ${slug}:`, error);
  }
  
  // Default permissions: only the agent itself can read/write
  return {
    slug,
    readableBy: [slug],
    writableBy: [slug],
    public: false,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Save permissions for an agent's memory
 */
export async function saveMemoryPermissions(permissions: MemoryPermission): Promise<void> {
  await ensureDirectory(PERMISSIONS_DIR);
  const permPath = path.join(PERMISSIONS_DIR, `${permissions.slug}.json`);
  
  const updatedPermissions = {
    ...permissions,
    updatedAt: new Date().toISOString(),
  };
  
  await writeFileContent(permPath, JSON.stringify(updatedPermissions, null, 2));
}

/**
 * Check if an agent can read another agent's memory
 */
export async function canReadMemory(
  targetSlug: string,
  requestingSlug: string
): Promise<boolean> {
  // Always allow reading own memory
  if (targetSlug === requestingSlug) {
    return true;
  }
  
  const permissions = await getMemoryPermissions(targetSlug);
  
  // Check if public
  if (permissions.public) {
    return true;
  }
  
  // Check if in readableBy list
  return permissions.readableBy.includes(requestingSlug);
}

/**
 * Check if an agent can write to another agent's memory
 */
export async function canWriteMemory(
  targetSlug: string,
  requestingSlug: string
): Promise<boolean> {
  // Always allow writing to own memory
  if (targetSlug === requestingSlug) {
    return true;
  }
  
  const permissions = await getMemoryPermissions(targetSlug);
  
  // Check if in writableBy list
  return permissions.writableBy.includes(requestingSlug);
}

/**
 * Grant read access to an agent
 */
export async function grantReadAccess(
  targetSlug: string,
  grantToSlug: string
): Promise<void> {
  const permissions = await getMemoryPermissions(targetSlug);
  
  if (!permissions.readableBy.includes(grantToSlug)) {
    permissions.readableBy.push(grantToSlug);
    await saveMemoryPermissions(permissions);
  }
}

/**
 * Grant write access to an agent
 */
export async function grantWriteAccess(
  targetSlug: string,
  grantToSlug: string
): Promise<void> {
  const permissions = await getMemoryPermissions(targetSlug);
  
  if (!permissions.writableBy.includes(grantToSlug)) {
    permissions.writableBy.push(grantToSlug);
    await saveMemoryPermissions(permissions);
  }
}

/**
 * Revoke read access from an agent
 */
export async function revokeReadAccess(
  targetSlug: string,
  revokeFromSlug: string
): Promise<void> {
  const permissions = await getMemoryPermissions(targetSlug);
  
  permissions.readableBy = permissions.readableBy.filter(slug => slug !== revokeFromSlug);
  await saveMemoryPermissions(permissions);
}

/**
 * Revoke write access from an agent
 */
export async function revokeWriteAccess(
  targetSlug: string,
  revokeFromSlug: string
): Promise<void> {
  const permissions = await getMemoryPermissions(targetSlug);
  
  permissions.writableBy = permissions.writableBy.filter(slug => slug !== revokeFromSlug);
  await saveMemoryPermissions(permissions);
}

/**
 * Set memory as public (readable by all agents)
 */
export async function setMemoryPublic(slug: string, isPublic: boolean): Promise<void> {
  const permissions = await getMemoryPermissions(slug);
  permissions.public = isPublic;
  await saveMemoryPermissions(permissions);
}

/**
 * List all agents that can read a specific agent's memory
 */
export async function listReadableBy(slug: string): Promise<string[]> {
  const permissions = await getMemoryPermissions(slug);
  return permissions.readableBy;
}

/**
 * List all agents that can write to a specific agent's memory
 */
export async function listWritableBy(slug: string): Promise<string[]> {
  const permissions = await getMemoryPermissions(slug);
  return permissions.writableBy;
}
