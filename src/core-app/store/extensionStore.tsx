/**
 *
 * This file defines a Zustand store for managing application-wide settings
 * and selected downloads. It provides functionalities to update settings
 * such as default download location, speed, and connection limits.
 *
 * Dependencies:
 * - Zustand: A small, fast state-management solution.
 * - Zustand middleware for persistence.
 */

// Interface for download settings
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

function asExtendedNames(extensions: any[]) {
  return extensions
    .filter(({ active }: any) => active)
    .sort((a: any, b: any) => a.priority - b.priority)
    .map(({ extendedName }: any) => extendedName);
}

// Create the main store with persistence
export const useExtensionStore = create<any>()(
  persist(
    (set, get) => {
      async function load() {
        const extensions = await window.extendr.getExtensions();

        set({
          extensions,
          originalExtensions: asExtendedNames(extensions),
          needsRestart: false,
        });
      }

      load();

      return {
        extensions: [] as any[],
        originalExtensions: [] as string[],
        needsRestart: false,

        getInactive() {
          const { extensions } = get();

          return extensions.filter(({ active }: any) => !active);
        },

        getActive() {
          const { extensions } = get();

          return extensions
            .filter(({ active }: any) => active)
            .sort((a: any, b: any) => a.priority - b.priority);
        },

        getAll() {
          const { extensions } = get();

          return extensions;
        },

        async sortByDependencies() {
          const { extensions } = get();

          // Build a dependency graph
          const graph = new Map<string, Set<string>>();
          const inDegree = new Map<string, number>();

          // Initialize graph for all extensions
          for (const extension of extensions) {
            const extName = extension.extendedName;

            if (!graph.has(extName)) graph.set(extName, new Set());

            if (!inDegree.has(extName)) inDegree.set(extName, 0);
          }

          // Build edges based on dependencies
          for (const extension of extensions) {
            const dependencies =
              extension.packageJson?.extendrDependencies ?? [];
            const extName = extension.extendedName;

            for (const dep of dependencies) {
              // Find the dependency extension
              const depExtension = extensions.find(
                ({ name, extendedName }: any) =>
                  name === dep || extendedName === dep,
              );

              if (!depExtension) continue;

              const depName = depExtension.extendedName;

              if (graph.get(depName)?.has(extName)) continue;

              // Add edge: dependency -> dependent
              graph.get(depName)?.add(extName);
              inDegree.set(extName, (inDegree.get(extName) || 0) + 1);
            }
          }

          // Topological sort using Kahn's algorithm
          const sorted: string[] = [];
          const queue: string[] = [];

          // Find all nodes with no incoming edges
          for (const [extName, degree] of inDegree.entries()) {
            if (degree === 0) queue.push(extName);
          }

          while (queue.length > 0) {
            const current = queue.shift()!;
            sorted.push(current);

            // For each dependent of current
            const dependents = graph.get(current) || new Set();
            for (const dependent of dependents) {
              const newDegree = (inDegree.get(dependent) || 0) - 1;
              inDegree.set(dependent, newDegree);

              if (newDegree === 0) queue.push(dependent);
            }
          }

          // Update priorities based on sorted order
          const activeExtensions = extensions.filter((ext: any) => ext.active);
          const sortedActive = sorted.filter((extName) =>
            activeExtensions.some((ext: any) => ext.extendedName === extName),
          );

          await this.fromExtendedNames(sortedActive);
        },

        async fromExtendedNames(extendedNames: string[]) {
          const { extensions, originalExtensions } = get();

          for (const extension of extensions) {
            extension.priority = extendedNames.indexOf(extension.extendedName);
            extension.active = extension.priority > -1;
          }

          await window.extendr.setLoadOrder(extendedNames);

          set({
            extensions,
            needsRestart:
              originalExtensions.join(',') !== extendedNames.join(','),
          });
        },

        async activate(name: string, index: number) {
          const { extensions, originalExtensions, getActive } = get();
          const activeExtensions: any[] = getActive();

          // Move the extension to the specified index within active extensions
          const extensionToMove = extensions.find(
            (ext: any) => ext.name === name,
          );

          if (!extensionToMove) return;

          // Remove the extension from its current position
          const filteredActive = activeExtensions.filter(
            (ext: any) => ext.name !== name,
          );
          // Insert it at the new index
          filteredActive.splice(index, 0, extensionToMove);

          for (const extension of extensions) {
            extension.priority = filteredActive.findIndex(
              (v: any) => v.name === extension.name,
            );
            extension.active = extension.priority > -1;
          }

          const newExtendedNames = asExtendedNames(extensions);

          await window.extendr.setLoadOrder(newExtendedNames);

          set({
            extensions,
            needsRestart:
              originalExtensions.join(',') !== newExtendedNames.join(','),
          });
        },

        async deactivate(name: string) {
          const { extensions, originalExtensions } = get();
          const extension = extensions.find((v: any) => v.name === name);

          if (!extension) return;

          extension.active = false;

          for (const extension of extensions
            .filter(({ active }: any) => active)
            .sort((a: any, b: any) => a.priority - b.priority)) {
            extension.priority = extensions.findIndex(
              (v: any) => v.name === extension.name,
            );
            extension.active = extension.priority > -1;
          }

          const newExtendedNames = asExtendedNames(extensions);

          await window.extendr.setLoadOrder(newExtendedNames);

          set({
            extensions,
            needsRestart:
              originalExtensions.join(',') !== newExtendedNames.join(','),
          });
        },

        async reset() {
          const { originalExtensions } = get();

          await window.extendr.setLoadOrder(originalExtensions);
          await load();
        },

        load,
      };
    },
    {
      name: 'extension-storage', // Name of the storage
      storage: createJSONStorage(() => localStorage), // Use local storage for persistence
    },
  ),
);
