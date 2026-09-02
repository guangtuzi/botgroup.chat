import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// Shared prose styling for AI-group / claw chat messages.
// Only the "own message" text-colour branch differs between the two
// chat UIs, so it is passed in as `ownClassName` by each caller.
const MARKDOWN_PROSE_CLASS = `prose dark:prose-invert max-w-none
  [&_h2]:py-1
  [&_h2]:m-0
  [&_h3]:py-1.5
  [&_h3]:m-0
  [&_p]:m-0
  [&_pre]:bg-gray-900
  [&_pre]:p-2
  [&_pre]:m-0
  [&_pre]:rounded-lg
  [&_pre]:text-gray-100
  [&_pre]:whitespace-pre-wrap
  [&_pre]:break-words
  [&_pre_code]:whitespace-pre-wrap
  [&_pre_code]:break-words
  [&_code]:text-sm
  [&_code]:text-gray-400
  [&_code:not(:where([class~="language-"]))]:text-pink-500
  [&_code:not(:where([class~="language-"]))]:bg-transparent
  [&_a]:text-blue-500
  [&_a]:no-underline
  [&_ul]:my-2
  [&_ol]:my-2
  [&_li]:my-1
  [&_blockquote]:border-l-4
  [&_blockquote]:border-border
  [&_blockquote]:pl-4
  [&_blockquote]:my-2
  [&_blockquote]:italic`;

export default function MarkdownMessage({
  content,
  ownClassName = '',
}: {
  content: string;
  ownClassName?: string;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      className={`${MARKDOWN_PROSE_CLASS} ${ownClassName}`}
    >
      {content}
    </ReactMarkdown>
  );
}
