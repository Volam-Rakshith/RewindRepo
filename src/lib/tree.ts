import type { GitTreeItem, TreeNode } from '../types';

export function buildTree(items: GitTreeItem[]): TreeNode {
  const root: TreeNode = { name: '/', path: '', type: 'tree', children: [] };
  const byPath = new Map<string, TreeNode>([['', root]]);

  const sorted = [...items].sort((a, b) => a.path.localeCompare(b.path));

  for (const item of sorted) {
    const segments = item.path.split('/');
    let current = root;
    let currentPath = '';

    segments.forEach((segment, index) => {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const isLeaf = index === segments.length - 1;
      let node = byPath.get(currentPath);
      if (!node) {
        node = {
          name: segment,
          path: currentPath,
          type: isLeaf ? item.type : 'tree',
          sha: isLeaf ? item.sha : undefined,
          size: isLeaf ? item.size : undefined,
          children: []
        };
        current.children.push(node);
        byPath.set(currentPath, node);
      }
      if (isLeaf) {
        node.type = item.type;
        node.sha = item.sha;
        node.size = item.size;
      }
      current = node;
    });
  }

  sortNodes(root);
  return root;
}

function sortNodes(node: TreeNode): void {
  node.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'tree' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  node.children.forEach(sortNodes);
}

export function findTreeItem(items: GitTreeItem[], path: string): GitTreeItem | undefined {
  return items.find((item) => item.path === path);
}

export function findReadme(items: GitTreeItem[]): GitTreeItem | undefined {
  return items.find((item) => /^readme(\.(md|markdown|txt|rst))?$/i.test(item.path));
}

export function treeContainsPath(items: GitTreeItem[], path: string): boolean {
  return items.some((item) => item.path === path);
}
