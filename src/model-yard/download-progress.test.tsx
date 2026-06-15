import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DownloadProgressPopup } from "./download-progress";

describe("DownloadProgressPopup", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <DownloadProgressPopup
        model="llama3.2:latest"
        open={false}
        pullBusy={false}
        progress={[]}
        overallProgress={null}
        onClose={() => undefined}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows active progress and latest status", () => {
    render(
      <DownloadProgressPopup
        model="llama3.2:latest"
        open
        pullBusy
        progress={[{ status: "pulling manifest" }]}
        overallProgress={{ completed: 50, total: 100, ratio: 0.5 }}
        latestStatus="pulling layer"
        onClose={() => undefined}
      />,
    );

    expect(screen.getByText("Downloading model")).toBeInTheDocument();
    expect(screen.getByText("llama3.2:latest")).toBeInTheDocument();
    expect(screen.getByText("pulling layer")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("calls close when the hide button is clicked", async () => {
    const onClose = vi.fn();
    render(
      <DownloadProgressPopup
        model="llama3.2:latest"
        open
        pullBusy={false}
        progress={[{ status: "success" }]}
        overallProgress={{ completed: 100, total: 100, ratio: 1 }}
        onClose={onClose}
      />,
    );

    await userEvent.click(screen.getByTitle("Hide download popup"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
