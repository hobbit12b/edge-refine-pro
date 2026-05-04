import JSZip from 'jszip';
import { AnimationChapter, Frame, KeyBinding, SpriteSheetSettings } from '@/types';

type SerializedFrame = Pick<Frame, 'id' | 'durationMultiplier' | 'offset' | 'trimmedBox' | 'originalWidth' | 'originalHeight' | 'aiBgRemoved'> & {
  filename: string;
};

interface ProjectData {
  settings: SpriteSheetSettings;
  chapters?: AnimationChapter[];
  bindings?: KeyBinding[];
  activeBindingId?: string;
  frames: SerializedFrame[];
}

export async function serializeProject({
  settings,
  chapters,
  bindings,
  frames,
}: {
  settings: SpriteSheetSettings;
  chapters: AnimationChapter[];
  bindings: KeyBinding[];
  frames: Frame[];
}): Promise<Blob> {
  const zip = new JSZip();
  const projectData: ProjectData = {
    settings,
    chapters,
    bindings,
    frames: frames.map((f) => ({
      id: f.id,
      durationMultiplier: f.durationMultiplier,
      offset: f.offset,
      trimmedBox: f.trimmedBox,
      originalWidth: f.originalWidth,
      originalHeight: f.originalHeight,
      aiBgRemoved: f.aiBgRemoved,
      filename: `frame_${f.id}.png`,
    })),
  };

  zip.file('project.json', JSON.stringify(projectData));
  const imagesFolder = zip.folder('images');

  if (imagesFolder) {
    for (const frame of frames) {
      imagesFolder.file(`frame_${frame.id}.png`, frame.blob);
    }
  }

  return zip.generateAsync({ type: 'blob' });
}

export async function deserializeProject({
  file,
  createTrackedUrl,
}: {
  file: File;
  createTrackedUrl: (blob: Blob) => string;
}): Promise<{ projectData: ProjectData; loadedFrames: Frame[] }> {
  const zip = await JSZip.loadAsync(file);
  const projectFile = zip.file('project.json');
  if (!projectFile) throw new Error('Invalid project file: project.json missing');

  const projectData = JSON.parse(await projectFile.async('string')) as ProjectData;
  const loadedFrames: Frame[] = [];
  const imagesFolder = zip.folder('images');

  if (imagesFolder) {
    for (let i = 0; i < projectData.frames.length; i++) {
      const fData = projectData.frames[i];
      const imageFile = imagesFolder.file(fData.filename);
      if (imageFile) {
        const blob = await imageFile.async('blob');
        if (blob) {
          const url = createTrackedUrl(blob);
          loadedFrames.push({
            ...fData,
            index: i,
            blob,
            url,
          });
        }
      }
    }
  }

  return { projectData, loadedFrames };
}
