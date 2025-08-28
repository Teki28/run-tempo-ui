import { BlogPostPreview } from '@/types/blog';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

async function getPosts(lang: string) {
  try {
    let posts;
    switch (lang) {
      case 'en':
        posts = await import('./data/posts_en.json');
        break;
      case 'zh':
        posts = await import('./data/posts_zh.json');
        break;
      case 'ja':
        posts = await import('./data/posts_ja.json');
        break;
      default:
        posts = await import('./data/posts_en.json'); // fallback to English
    }
    return posts.default;
  } catch (error) {
    console.error(`Error loading posts for language "${lang}":`, error);
    return null;
  }
};

// This is executed at build time
export async function generateStaticParams() {
  return [
    { lang: 'en' },
    { lang: 'zh' },
    { lang: 'ja' }
  ];
}

// Generate metadata for SEO
export async function generateMetadata() {
  const title = 'Blog - Run Tempo';
  const description = 'Discover articles about running, music tempo adjustment, and getting the most out of your sports watch.';

  return {
    title,
    description,
    alternates: {
      languages: {
        'en': 'Discover articles about running, music tempo adjustment, and getting the most out of your sports watch.',
        'zh': '探索关于跑步、音乐节奏调整和充分利用运动手表的文章。',
        'ja': 'ランニング、音楽のテンポ調整、スポーツウォッチの活用に関する記事をご覧ください。'
      }
    }
  };
  return {
    title,
    description,
    alternates: {
      languages: {
        'en': '/en/blog',
        'zh': '/zh/blog',
        'ja': '/ja/blog',
      },
    },
  };
}

export default async function BlogList({params}: {params: Promise<{ lang: string }>}) {
  const { lang } = await params;

  const posts = await getPosts(lang);
  
  if (!posts) {
    notFound();
  }

  const blogPosts: BlogPostPreview[] = posts.posts.map(({ ...post }) => post as BlogPostPreview);

  const title = lang === 'en' ? 'Blog' : lang === 'zh' ? '博客' : 'ブログ';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Link href={`/${lang}`} className="inline-flex items-center gap-3 hover:opacity-80 transition-opacity">
          <Image
            src="/app_logo.jpg"
            alt="Run Pulse Logo"
            width={50}
            height={50}
            className="rounded-lg"
          />
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Run Tempo</h1>
            <p className="text-sm text-gray-600">← Back to main page</p>
          </div>
        </Link>
      </div>
      <h2 className="text-4xl font-bold mb-8">{title}</h2>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {blogPosts.map((post) => (
          <article key={post.id} className="border rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-2">{post.title}</h2>
            <div className="text-gray-600 mb-4">
              <time>{post.publishedAt}</time> • <span>{post.author}</span>
            </div>
            <div className="flex gap-2 mb-4">
              {post.tags.map((tag) => (
                <span key={tag} className="bg-gray-100 px-2 py-1 rounded text-sm">
                  {tag}
                </span>
              ))}
            </div>
            <Link
              href={`/${lang}/blog/${post.slug}`}
              className="text-blue-600 hover:text-blue-800"
            >
              {lang === 'en' ? 'Read more' : lang === 'zh' ? '阅读更多' : '続きを読む'} →
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
