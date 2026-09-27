import { useMemo, useState } from 'react';
import type { RepoTree, TreeNode } from '../types';
import { formatBytes } from '../lib/text';

export function FileExplorer({
  tree,
  selectedPath,
  onOpen
}: {
  tree: RepoTree | null;
  selectedPath?: string;
  onOpen: (node: TreeNode) => void;
}) {
  const [filter, setFilter] = useState('');
  const filtered = useMemo(() => {
    if (!tree || !filter.trim()) return tree?.root ?? null;
    return filterTree(tree.root, filter.trim().toLowerCase());
  }, [tree, filter]);

  if (!tree) {
    return (
      <section className="file-explorer panel skeleton-panel">
        <div className="skeleton line" />
        <div className="skeleton block" />
      </section>
    );
  }

  return (
    <section className="file-explorer panel" aria-label="Historical file explorer">
      <div className="panel-header">
        <div>
          <p className="eyebrow">File explorer</p>
          <h2>Historical source tree</h2>
        </div>
        <span className="tree-count">{tree.items.length.toLocaleString()} objects</span>
      </div>
      {tree.truncated ? (
        <div className="callout warning">
          GitHub marked this tree as truncated. Some files are hidden because the repository state is too large.
        </div>
      ) : null}
      <input
        className="tree-filter"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder="Filter paths…"
        aria-label="Filter file paths"
      />
      <div className="tree-scroll">
        {filtered ? (
          <TreeRows node={filtered} selectedPath={selectedPath} onOpen={onOpen} depth={0} root />
        ) : (
          <p className="empty-state">No files match this filter.</p>
        )}
      </div>
    </section>
  );
}

function TreeRows({
  node,
  depth,
  root,
  selectedPath,
  onOpen
}: {
  node: TreeNode;
  depth: number;
  root?: boolean;
  selectedPath?: string;
  onOpen: (node: TreeNode) => void;
}) {
  const [expanded, setExpanded] = useState(root || depth < 1);
  const isFile = node.type === 'blob';

  if (root) {
    return (
      <>
        {node.children.map((child) => (
          <TreeRows key={child.path} node={child} selectedPath={selectedPath} onOpen={onOpen} depth={0} />
        ))}
      </>
    );
  }

  return (
    <div>
      <button
        className={`tree-row ${selectedPath === node.path ? 'active' : ''}`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={() => {
          if (isFile) onOpen(node);
          else setExpanded((current) => !current);
        }}
      >
        <span className="tree-icon" aria-hidden="true">
          {isFile ? '◇' : expanded ? '▾' : '▸'}
        </span>
        <span className="tree-name">{node.name}</span>
        {isFile ? <span className="tree-size">{formatBytes(node.size)}</span> : null}
      </button>
      {!isFile && expanded
        ? node.children.map((child) => (
            <TreeRows
              key={child.path}
              node={child}
              selectedPath={selectedPath}
              onOpen={onOpen}
              depth={depth + 1}
            />
          ))
        : null}
    </div>
  );
}

function filterTree(node: TreeNode, query: string): TreeNode | null {
  if (node.type === 'blob') return node.path.toLowerCase().includes(query) ? { ...node } : null;
  const children = node.children.map((child) => filterTree(child, query)).filter(Boolean) as TreeNode[];
  if (children.length || node.path.toLowerCase().includes(query)) return { ...node, children };
  return null;
}
