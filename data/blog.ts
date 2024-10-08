import fs from "fs";
import path from "path";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeStringify from "rehype-stringify";
import matter from "gray-matter";

interface _Metadata{
    title: string
    publishedAt: string
    summary?: string
    image?: string
}

function getMdxFiles(dir:string){
    return fs.readdirSync(dir).filter(file => path.extname(file) === '.mdx')
}

export async function markdowntohtml(markdown:string){
    const p = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypePrettyCode, {
        theme: {
            light: 'min-light',
            dark: 'min-dark'
        },
        keepBackground: false,
    })
    .use(rehypeStringify)
    .process(markdown);
    return p.toString()
}

export async function getPost(slug: string){
    const filePath = path.join('content', `${slug}.mdx`);
    const source = fs.readFileSync(filePath, 'utf-8');
    const {content: rawContent, data: metadata} = matter(source);
    const content = await markdowntohtml(rawContent);
    return {
        source: content,
        metadata,
        slug,
    }
}

async function getAllPosts(dir: string){
    const mdxFiles = getMdxFiles(dir);
    return Promise.all(mdxFiles.map(async (file) => {
        const slug = path.basename(file, path.extname(file))
        const {metadata, source} = await getPost(slug);
        return {
            metadata, slug, source
        }
    }))
}

export async function getBlogPosts() {
    return getAllPosts(path.join(process.cwd(), 'content'));
}