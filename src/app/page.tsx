import { WorkspaceProvider } from '@/components/workspace-provider';
import { Workspace } from '@/components/workspace';
export default function Page() {
  return (
    <WorkspaceProvider>
      <Workspace />
    </WorkspaceProvider>
  );
}
