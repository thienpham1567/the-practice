import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createHeadingNode, $createQuoteNode, type HeadingTagType } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from "@lexical/list";
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
  type ElementNode,
} from "lexical";
import type { ReactNode } from "react";

function ToolButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="h-8 min-w-8 rounded-sm px-2 text-sm text-ink-soft transition-colors hover:bg-paper-edge hover:text-ink"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-rule" aria-hidden="true" />;
}

export function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();

  const setBlock = (create: () => ElementNode) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) $setBlocksType(selection, create);
    });
  };

  const setHeading = (tag: HeadingTagType) => setBlock(() => $createHeadingNode(tag));

  return (
    <div className="flex items-center gap-0.5">
      <ToolButton label="Undo" onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}>
        ↩
      </ToolButton>
      <ToolButton label="Redo" onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}>
        ↪
      </ToolButton>

      <Divider />

      <ToolButton
        label="Bold"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
      >
        <strong>B</strong>
      </ToolButton>
      <ToolButton
        label="Italic"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
      >
        <em>I</em>
      </ToolButton>

      <Divider />

      <ToolButton label="Body text" onClick={() => setBlock($createParagraphNode)}>
        ¶
      </ToolButton>
      <ToolButton label="Heading 1" onClick={() => setHeading("h1")}>
        H1
      </ToolButton>
      <ToolButton label="Heading 2" onClick={() => setHeading("h2")}>
        H2
      </ToolButton>
      <ToolButton label="Heading 3" onClick={() => setHeading("h3")}>
        H3
      </ToolButton>

      <Divider />

      <ToolButton
        label="Bulleted list"
        onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}
      >
        •
      </ToolButton>
      <ToolButton
        label="Numbered list"
        onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}
      >
        1.
      </ToolButton>
      <ToolButton
        label="Remove list"
        onClick={() => editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)}
      >
        ⌫
      </ToolButton>
      <ToolButton label="Quote" onClick={() => setBlock($createQuoteNode)}>
        ❝
      </ToolButton>
    </div>
  );
}
