import {
  changeRequestLinkResolver,
  changeRequestReferenceAutolinker,
} from "@t3tools/client-runtime/pull-request-markdown";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vite-plus/test";

import {
  remarkPullRequestAutolinks,
  remarkPullRequestRelativeUrls,
} from "./pullRequestMarkdown.logic";

type Node = {
  type: string;
  value?: string;
  url?: string;
  data?: { hProperties?: Record<string, unknown> };
  children?: Node[];
};

function links(markdown: string) {
  const autolinks = changeRequestReferenceAutolinker({
    provider: "github",
    url: "https://github.com/team/repo/pull/8",
  })!;
  const tree = unified().use(remarkParse).parse(markdown) as Node;
  remarkPullRequestAutolinks({ autolinks })(tree as never);
  const found: Array<[string | undefined, string | undefined, unknown]> = [];
  const visit = (node: Node) => {
    if (node.type === "link") {
      found.push([
        node.children?.[0]?.value,
        node.url,
        node.data?.hProperties?.["dataPullRequestAutolink"],
      ]);
    }
    node.children?.forEach(visit);
  };
  visit(tree);
  return found;
}

describe("remarkPullRequestAutolinks", () => {
  it("links the host's references in prose and leaves links and code alone", () => {
    expect(links("Fixes #12 in **abcdef1**. [#13](https://example.com) `#14`")).toEqual([
      ["#12", "https://github.com/team/repo/issues/12", "reference"],
      ["abcdef1", "https://github.com/team/repo/commit/abcdef1", "commit"],
      ["#13", "https://example.com", undefined],
    ]);
  });
});

describe("remarkPullRequestRelativeUrls", () => {
  it("resolves relative images and links, in html too, against the pull request page", () => {
    const resolveUrl = changeRequestLinkResolver({
      provider: "github",
      url: "https://github.com/team/repo/pull/8",
    })!;
    const tree = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .parse(
        [
          "| Before | After |",
          "| --- | --- |",
          '| <img width="300" src="../blob/abc/a.png?raw=true"> | ![b](/team/repo/blob/abc/b.png) |',
          "",
          "[docs](docs/theme.md) [top](#top) `![c](../blob/abc/c.png)`",
        ].join("\n"),
      ) as Node;
    remarkPullRequestRelativeUrls({ resolveUrl })(tree as never);
    const found: Array<string | undefined> = [];
    const visit = (node: Node) => {
      if (node.url !== undefined) found.push(node.url);
      if (node.type === "html" || node.type === "inlineCode") found.push(node.value);
      node.children?.forEach(visit);
    };
    visit(tree);
    expect(found).toEqual([
      '<img width="300" src="https://github.com/team/repo/blob/abc/a.png?raw=true">',
      "https://github.com/team/repo/blob/abc/b.png",
      "https://github.com/team/repo/pull/docs/theme.md",
      "#top",
      "![c](../blob/abc/c.png)",
    ]);
  });
});
