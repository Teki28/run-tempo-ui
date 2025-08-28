import type { BlogPost } from '@/types/blog';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const getPosts = async (lang: string) => {
  try {
    switch (lang) {
      case 'en':
        return await import('../data/posts_en.json');
      case 'zh':
        return await import('../data/posts_zh.json');
      case 'ja':
        return await import('../data/posts_ja.json');
      default:
        return await import('../data/posts_en.json'); // fallback to English
    }
  } catch (error) {
    console.error(`Error loading posts for language "${lang}":`, error);
    return null;
  }
};


// This is executed at build time
export async function generateStaticParams() {
  const languages = ['en', 'zh', 'ja'];
  const paths = [];

  for (const lang of languages) {
    const langPosts = await getPosts(lang);
    if (langPosts) {
      for (const post of langPosts.posts) {
        paths.push({
          lang,
          slug: post.slug,
        });
      }
    }
  }

  return paths;
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string; lang: string }> }) {

  const lang = (await params).lang;
  const slug = (await params).slug;
  const posts = await getPosts(lang);

  if (!posts) {
    notFound();
  }

  const post = posts.posts.find((p: BlogPost) => p.slug === slug);

  if (!post) {
    notFound();
  }

  return (
    <article className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
      <div className="text-gray-600 mb-8">
        <time>{post.publishedAt}</time> • <span>{post.author}</span>
      </div>
      <div className="flex gap-2 mb-8">
        {post.tags.map((tag: string) => (
          <span key={tag} className="bg-gray-100 px-2 py-1 rounded text-sm">
            {tag}
          </span>
        ))}
      </div>
      <div className="prose prose-lg max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({children}) => <h1 className="text-4xl font-bold mb-6">{children}</h1>,
            h2: ({children}) => <h2 className="text-3xl font-semibold mt-8 mb-4">{children}</h2>,
            h3: ({children}) => <h3 className="text-2xl font-semibold mt-6 mb-3">{children}</h3>,
            p: ({children}) => <p className="mb-4 leading-relaxed">{children}</p>,
            ul: ({children}) => <ul className="list-disc ml-6 mb-4">{children}</ul>,
            ol: ({children}) => <ol className="list-decimal ml-6 mb-4">{children}</ol>,
            li: ({children}) => <li className="mb-2">{children}</li>,
            blockquote: ({children}) => (
              <blockquote className="border-l-4 border-gray-300 pl-4 italic my-4">{children}</blockquote>
            ),
            // @ts-expect-error - inline is a valid prop for code elements in ReactMarkdown
            code: ({inline, children}) => 
              inline ? (
                <code className="bg-gray-100 rounded px-1">{children}</code>
              ) : (
                <code className="block bg-gray-100 p-4 rounded-lg my-4">{children}</code>
              ),
          }}
        >
          {post.content}
        </ReactMarkdown>
      </div>
    </article>
  );
}
