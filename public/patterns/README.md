# Pattern Assets Catalogue

This directory contains geometric, ornamental, and tile pattern SVGs used for atmospheric background textures, ambient corner ornamentation, and floating motifs across the Ihyaa platform.

All pattern files are optimized using `svgo` to minimize transfer footprint and prevent browser layout/render overhead.

| Filename | Source / Attribution | Optimized Size | Role / Usage |
|----------|----------------------|----------------|--------------|
| `corner-ornament.svg` | Geometric ornamental asset | ~15.9 KB | Elegant corner flourishes on cards and dialogs |
| `mandala.svg` | Islamic mandala collection | ~55.8 KB | Floating ambient background accent (hero, covers) |
| `interlocking-geometric.svg` | VectorStock (19496826) | ~35.7 KB | Intricate interlocking geometric mesh |
| `star-rosette.svg` | VectorStock (62287975) | ~13.4 KB | Star rosette medallion accent (single site-wide page texture pattern) |
| `girih.svg` | Ihyaa brand assets | ~0.27 KB | Classic 10-point Girih interlocking strapwork |

## Texture tuning

All texture settings are centralized in `src/styles/texture.css` (imported into `src/app/globals.css`). The following CSS variables can be adjusted per theme:

- `--texture-opacity`: Master opacity of the pattern overlay (`0.16` for Light/Sunset, `0.24` for Amoled/Black).
- `--texture-size`: Tile dimensions (`140px` by default for a sparse, breathable layout).
- `--texture-motif`: Scale factor of the motif inside each cell (`0.28`, ~28% fill).
- `--texture-rotate`: Tile rotation angle (`0deg`).
- `--texture-dim`: Strength of the central radial dim over the content column.
- `--texture-edge`: Strength of the subtle top and bottom page fade.


