import { useState } from "react";
import { Button } from "@bb/shared-ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@bb/shared-ui/dropdown-menu";
import { Icon } from "@bb/shared-ui/icon";
import { Input } from "@bb/shared-ui/input";
import { useIsCompactViewport } from "@bb/shared-ui/hooks/use-compact-viewport";
import { usePointerCoarse } from "@bb/shared-ui/hooks/use-pointer-coarse";
import { cn } from "@bb/shared-ui/lib/utils";
import {
  OPTION_BASE_CLASS_NAME,
  OPTION_INTERACTIVE_CLASS_NAME,
  OPTION_MUTED_CLASS_NAME,
  OPTION_TRIGGER_CONTENT_CLASS_NAME,
} from "@bb/shared-ui/option-display";

export interface ProjectSelectorOption {
  id: string;
  name: string;
}

export interface ProjectSelectorCreateProjectConfig {
  onCreate: () => void;
  disabled?: boolean;
  isCreating?: boolean;
}

interface ProjectSelectorProps {
  projects: readonly ProjectSelectorOption[];
  value: string | null;
  onChange: (projectId: string | null) => void;
  allowNoProject?: boolean;
  createProject?: ProjectSelectorCreateProjectConfig;
  disabled?: boolean;
  isLoading?: boolean;
  showChevronWhenDisabled?: boolean;
  className?: string;
  defaultOpen?: boolean;
  modal?: boolean;
}

const PROJECT_SEARCH_MIN_OPTIONS = 5;

export function ProjectSelector({
  projects,
  value,
  onChange,
  allowNoProject = false,
  createProject,
  disabled: disabledProp = false,
  isLoading = false,
  showChevronWhenDisabled = false,
  className,
  defaultOpen,
  modal,
}: ProjectSelectorProps) {
  const disabled = disabledProp || isLoading;
  const isCompactViewport = useIsCompactViewport();
  const isPointerCoarse = usePointerCoarse();
  const [searchQuery, setSearchQuery] = useState("");
  const showSearch = projects.length > PROJECT_SEARCH_MIN_OPTIONS;
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredProjects = showSearch
    ? projects.filter((project) =>
        project.name.toLowerCase().includes(normalizedQuery),
      )
    : projects;
  const selected = value !== null ? projects.find((p) => p.id === value) : null;
  const fallback = !allowNoProject && !selected ? projects[0] : null;
  const triggerLabel = isLoading
    ? "Loading projects…"
    : (selected?.name ?? fallback?.name ?? "Work in a project");
  const compactTriggerLabel = isLoading
    ? "Loading…"
    : (selected?.name ?? fallback?.name ?? "No project");
  const triggerIcon =
    isLoading || selected || fallback ? "Folder" : "FolderPlus";
  const createProjectAction = createProject;
  const createProjectLabel = createProjectAction?.isCreating
    ? "Creating..."
    : "New project";
  const showActionSeparator =
    projects.length > 0 && (Boolean(createProject) || allowNoProject);

  return (
    <DropdownMenu
      defaultOpen={defaultOpen}
      onOpenChange={(open) => {
        if (open) setSearchQuery("");
      }}
      modal={modal}
    >
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Project"
          aria-busy={isLoading || undefined}
          disabled={disabled}
          data-promptbox-project-control=""
          className={cn(
            OPTION_BASE_CLASS_NAME,
            !disabled && OPTION_INTERACTIVE_CLASS_NAME,
            disabled && "cursor-default disabled:opacity-100",
            OPTION_MUTED_CLASS_NAME,
            className,
          )}
        >
          <span className={OPTION_TRIGGER_CONTENT_CLASS_NAME}>
            <Icon
              name={triggerIcon}
              className="size-3.5 shrink-0"
              aria-hidden
            />
            <span className="min-w-0 truncate" data-promptbox-full-label="">
              {triggerLabel}
            </span>
            <span className="min-w-0 truncate" data-promptbox-compact-label="">
              {compactTriggerLabel}
            </span>
          </span>
          {disabled && !showChevronWhenDisabled ? null : (
            <Icon
              name="ChevronDown"
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom" className="w-52">
        {showSearch ? (
          <div
            className={cn(
              "border-b border-border px-1.5 py-1",
              isCompactViewport ? "-mx-2 -mt-2" : "-mx-1 -mt-1",
            )}
          >
            <div className="relative">
              <Icon
                name="Search"
                className="pointer-events-none absolute left-1.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                autoFocus={!isCompactViewport && !isPointerCoarse}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Escape") event.stopPropagation();
                }}
                placeholder="Search projects"
                aria-label="Search projects"
                className="h-7 border-0 bg-transparent pl-8 pr-2 text-xs shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
        ) : null}
        <DropdownMenuLabel className={showSearch ? "pt-2" : undefined}>
          Project
        </DropdownMenuLabel>
        {filteredProjects.map((project) => (
          <DropdownMenuItem
            key={project.id}
            onSelect={() => onChange(project.id)}
          >
            <Icon
              name="Folder"
              className="size-4 text-muted-foreground"
              aria-hidden
            />
            {project.name}
            <Icon
              name="Check"
              className={cn(
                "ml-auto size-4",
                project.id === value ? "opacity-100" : "opacity-0",
              )}
              aria-hidden
            />
          </DropdownMenuItem>
        ))}
        {showSearch && filteredProjects.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            No projects found
          </div>
        ) : null}
        {showActionSeparator ? <DropdownMenuSeparator /> : null}
        {createProjectAction ? (
          <DropdownMenuItem
            disabled={createProjectAction.disabled}
            onSelect={() => createProjectAction.onCreate()}
          >
            <Icon
              name="FolderPlus"
              className="size-4 text-muted-foreground"
              aria-hidden
            />
            {createProjectLabel}
          </DropdownMenuItem>
        ) : null}
        {allowNoProject ? (
          <DropdownMenuItem onSelect={() => onChange(null)}>
            <Icon
              name="FolderMinus"
              className="size-4 text-muted-foreground"
              aria-hidden
            />
            Don&apos;t work in a project
            <Icon
              name="Check"
              className={cn(
                "ml-auto size-4",
                value === null ? "opacity-100" : "opacity-0",
              )}
              aria-hidden
            />
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
