// ============================================================
// STARBOY-STYLE STAR SHELL  (metallic keychain replica, DIY)
// ============================================================
// Free software: OpenSCAD (openscad.org). Open this file, tweak
// the variables below (live preview updates instantly), then set
// `part` (below) to the piece you want and export STL:
//   "front"  -> the front shell half (has the screen pocket)
//   "back"   -> the back shell half (has the engraved medallion)
//   "bezel"  -> just the printable chrome bezel ring around the screen
//   "ring"   -> a printable open jump-ring (or just buy metal ones, see notes)
//   "clip"   -> the pants/pocket clip
//   "preview"-> everything assembled together, for looking at only
//
// PRINT NOTES
// - Print "front" and "back" separately, sand smooth, chrome-spray
//   the OUTSIDE only (mask the inside faces / mating lip if you can).
// - The back medallion is engraved right in the print (text +
//   sunburst + little star badge). You can paint it as-is for a
//   "brushed" look, OR glue a bought engraved steel tag over it if
//   you want real metal there instead — the recess is sized for that.
// - The clip is a plastic spring clip like a pocket-knife clip. PETG
//   flexes better than PLA and is less likely to snap — print the
//   clip in PETG if you have it. Test-fit on your actual pants
//   waistband/pocket edge before gluing it on for good.
// - The "ring" part is a printable open jump ring. Printed rings this
//   small are genuinely more fragile than a $3 bag of metal jump
//   rings — it's included because you asked for it in the file, but
//   for something you'll actually clip to your pants every day, a
//   real metal jump ring/carabiner clip is the safer call.
//
// ============================================================
// COMPONENT FIT — measured, and what drives the dimensions
// ============================================================
// Every number below was used to size the shell. If you swap a part
// for a different one, re-check this table before printing.
//
//   PART                        L x W x H (mm)      WHERE IT GOES
//   GC9A01 1.28" round display  37.5 dia x 5.4      front pocket, centred
//     ^ the PCB. The 32.4 quoted everywhere is the GLASS - sizing to that
//       number is exactly why the pocket had to be re-cut as a step.
//   ESP32-C3 SuperMini          22.5 x 18.0 x 3.2   behind display, centred
//   MPU6050 (headers removed)   21.2 x 16.4 x 1.6   stacked behind ESP32
//   LiPo 402030 (300mAh)        30.0 x 20.0 x 4.0   stacked at the back
//   DS18B20 (TO-92)              4.3 dia x 5.2      at the temp vent, 144deg arm
//   MAX4466 mic board           15.6 x 10.5 x 5.0   at the mic port, 288deg arm
//   OV2640 camera (optional)     8.0 dia lens       camera pocket, 72deg arm
//
// DEPTH BUDGET (the tight axis):
//   body 18.0 - display pocket 5.5 - back wall 3.0      = 9.5 available
//   ESP32 3.2 + MPU6050 1.6 + battery 4.0               = 8.8 used
//   -> 0.7mm slack. Do not reduce body_thickness below 18.
//
//   The back wall is 3.0 rather than 2.2 because the medallion dish and
//   its engraving are cut into it. At 2.2 the engraved text punched
//   straight through into the cavity. There is an assert() guarding this.
//
// WIDTH CHECK (the centre region, bounded by the valleys):
//   usable central circle = 2 x (inner_radius - wall) = 39.6 dia
//   battery diagonal sqrt(30^2+20^2) = 36.1  -> fits
//   ESP32 diagonal sqrt(22.5^2+18^2) = 28.8  -> fits
//
// The ESP32-C3 must be oriented with its USB-C facing the 180deg valley
// so it lines up with the charging cutout. If your board's USB-C won't
// reach the wall, use a short USB-C pigtail rather than moving the port.
// ============================================================

/* [Overall size] */
// Proportions taken off the reference photos: a BIG central mass with
// SHORT, crisp points (the medallion reads ~55% of total width), not
// long thin spikes. The fat centre is also what makes the hardware fit —
// the 32.4mm display needs a ~40mm flat central region to sit in.
star_points      = 5;      // number of lobes
outer_radius     = 36;     // mm, tip-to-centre of each point
inner_radius     = 23;     // mm, valley radius. ~0.64 x outer = reference proportion.
                            // Do NOT drop this: the display's PCB ledge is 19.3mm in
                            // radius and the cavity wall has to clear it. Guarded by
                            // an assert below.
body_thickness   = 18;     // mm, total thickness. Sized directly from the measured
                            // component stack — see COMPONENT FIT below. Leaves
                            // 9.5mm behind the display for an 8.8mm stack.
edge_round       = 3.5;    // mm, unused by current geometry, kept for reference
tip_round        = 1.8;    // mm, how rounded each outer tip is in the flat 2D outline
valley_round     = 4;      // mm, how rounded each inner valley is in the flat 2D outline
wall             = 2.2;    // mm, side + front shell wall thickness
back_wall        = 3.0;    // mm, BACK wall is thicker on purpose: the medallion
                            // dish (1.2) plus its engraving (0.5) eat into it, and
                            // at 2.2 the engraved text cut straight through into
                            // the electronics cavity. Leaves a 1.8mm solid floor.

/* [Chamfer] */
// The body is a flat-faced slab (screen/medallion sit flush in true
// flat planes) with a tapered bevel near the top/bottom edges — this
// is what gives the faceted, jewel-cut look in the reference photos,
// instead of an organic rounded blob.
bevel_edge  = 2.2;    // mm, how much of the thickness is tapered at each face
bevel_scale = 0.93;   // profile shrink factor at the very edge of the bevel.
                       // Keep this HIGH (>=0.90). scale() shrinks toward the
                       // origin, so an aggressive value pulls the front face in
                       // past the display pocket edge in the valley directions
                       // and the screen ends up overhanging empty space.

/* [Eye / screen] */
// GC9A01 1.28" round module (Waveshare spec): the 32.4mm figure quoted
// everywhere is the DISPLAY GLASS, not the board — the PCB is Φ37.5mm.
// Sizing a 33.5mm pocket to "32.4mm module" does not fit. So the pocket
// is stepped: a 33.5mm opening at the face that the glass shows through,
// over a wider 38.6mm ledge that actually holds the PCB.
screen_offset_x     = 0;    // centred — margin to the valley edge is tight,
screen_offset_y     = 0;    // don't offset without re-running the asserts
screen_diameter     = 33.5; // mm, the visible opening (glass is 32.4)
screen_pcb_dia      = 38.6; // mm, Φ37.5 PCB + 1.1 clearance
screen_lip_depth    = 1.2;  // mm, depth of the narrow opening = retaining lip
screen_pocket_depth = 5.5;  // mm total; module is ~5.4mm thick
bezel_wall          = 1.4;  // mm, thickness of the printable chrome bezel ring — kept
                              // slim so the display doesn't dominate the face
bezel_height        = 3;    // mm
// The round module is Φ37.5 with a small tab sticking out to 40.4 overall
// that carries the 8-pin header. The notch has to clear that tab: it is
// SHALLOW radially and WIDE tangentially (these two were swapped before,
// which would have fouled the tab).
ribbon_slot_radial = 5;     // mm, how far the notch reaches outward
ribbon_slot_wide   = 14;    // mm, tangential width — tab is ~12mm

/* [Camera — optional] */
// Physical mounting space for a small camera module (e.g. OV2640),
// styled like the lens turret in the reference photos. Not required
// for the shake/cold/sound reactions — only matters if you later add
// face or gesture detection (needs an ESP32-S3 + real image processing,
// well beyond the C3). Cheap to include the hole now either way.
// Sits on the 72-degree arm at r=24: the arm is ~13.2mm wide there, so an
// 8mm lens leaves ~2.6mm of wall each side, and its inner edge clears the
// display bezel (r=18.15) by 1.85mm.
camera_dia          = 8;    // mm, lens opening
camera_bezel_wall   = 1.4;  // mm, raised ring around the lens
camera_pocket_depth = 2.6;  // mm
camera_r            = 24;   // mm from centre, along its arm
camera_ang          = 72;   // degrees

/* [Sensor vents] */
// The DS18B20 must see OUTSIDE air or it just reads the board's own heat
// and the cold/shiver behaviour never fires. The mic needs a sound path.
temp_vent_dia  = 4;    // mm, DS18B20 TO-92 body is 4.3mm dia — sits just inside
temp_vent_r    = 25;
temp_vent_ang  = 144;
mic_port_dia   = 2.5;  // mm
mic_port_r     = 25;
mic_port_ang   = 288;

/* [Charging port] */
// USB-C cutout in the valley opposite the keyring, like the port on the
// bottom edge of the reference photo. This exposes the ESP32-C3
// SuperMini's OWN USB-C — most SuperMini boards carry a single-cell LiPo
// charger on that same port plus a battery pad pair. CHECK YOUR BOARD: if
// yours has no charge IC, add a TP4056 module instead and line it up here.
charge_port_w     = 9.8;   // mm, USB-C receptacle is 9.0 wide + clearance
charge_port_h     = 3.8;   // mm, 3.2 tall + clearance
charge_port_ang   = 180;   // degrees — the valley opposite the bail
charge_port_z     = 1.5;   // mm, height of the port centre — lines up with the
                            // USB-C on an ESP32-C3 sitting directly behind the display

/* [Keyring bail] */
// A real integrated loop (not just a disc-with-hole) so a bought
// keyring/carabiner threads through it exactly like the reference:
// the loop lies flat against the star's face, hole runs front-to-back,
// and material tapers smoothly from the star tip out into the loop.
bail_offset  = 6.5;   // mm beyond the tip, where the loop is centered
bail_maj_r   = 5.5;   // mm, loop radius (tube-center to loop-center)
bail_min_r   = 2.0;   // mm, thickness of the loop's material

/* [Back medallion] */
// Reference proportion: the disc reads ~55% of the star's width, with two
// small arcs of text around the rim and a single star mark in the middle.
back_medallion_dia   = 36;   // mm (star is 70mm across). Max is ~41 before it
                              // runs past the back face's valley edge.
back_medallion_depth = 1.2;  // mm, kept shallow — this plus the engraving depth
                              // has to stay inside back_wall or it breaks through
back_text_top        = "SRIPADBUILDS";
back_text_bottom     = "STARBOY  PROTOTYPE";
back_text_size       = 2.2;  // mm — deliberately small; the star mark is the hero
back_badge_frac      = 0.30; // centre star size as a fraction of medallion radius

/* [Pants clip] */
clip_tab_len   = 15;   // mm, short inner tab (mounts to the star / holds the ring)
clip_gap       = 7;    // mm, stand-off gap for pocket/waistband fabric
clip_blade_len = 34;   // mm, outer spring blade length
clip_width     = 9;    // mm, extrusion width of the clip
clip_thick     = 2.2;  // mm, spring blade thickness
clip_hole_dia  = 4.5;

/* [Printable jump ring] */
ring_major_r = 9;      // mm
ring_tube_r  = 1.6;    // mm
ring_gap_deg = 30;     // degrees left open so you can flex it onto things

/* [Which piece to render] */
part = "preview"; // "front" | "back" | "bezel" | "ring" | "clip" | "preview"

// "fast" = quick low-poly render for eyeballing the design (seconds).
// "fine" = smooth high-poly geometry for your actual STL export before
// printing (can take several minutes to render, be patient).
quality = "fast";

// NOTE: $fn must stay >= ~48 here. Below that, the offset() chain in
// star_shape_2d() (used for both the body AND the hollow cavity) can
// produce degenerate/self-intersecting 2D geometry at these tight
// tip/valley radii — it silently unions away to an empty solid rather
// than erroring, which is a nasty bug to chase. Confirmed by testing.
$fn      = (quality == "fine") ? 96 : 48;
mink_fn  = (quality == "fine") ? 16 : 6;

// ─── build-time sanity checks ────────────────────────────────
// These each caught a real defect during design. If you change the
// numbers above, these stop you shipping a broken print.
assert(back_medallion_depth + 0.5 < back_wall,
       "Back engraving breaks through into the electronics cavity. Increase back_wall or reduce back_medallion_depth.");
assert(body_thickness - back_wall - 5.5 >= 8.8,
       "Not enough depth behind the display for the ESP32 + MPU6050 + battery stack (needs 8.8mm).");
// NOTE: the binding constraint is the display's PCB (38.6mm ledge), NOT the
// 32.4mm glass. Sizing to the glass is exactly the mistake that made the
// module not fit in the first place.
assert(inner_radius - wall > screen_pcb_dia/2,
       "Display PCB ledge is wider than the cavity at the valleys - the module would overhang empty space. Raise inner_radius.");
assert(bevel_scale * inner_radius > screen_diameter/2 + bezel_wall,
       "Chamfer pulls the front face in past the display bezel. Raise bevel_scale.");
assert(screen_lip_depth < screen_pocket_depth,
       "Screen lip must be shallower than the full pocket.");

// ------------------------------------------------------------
// Rounded/puffy star profile (2D) — double-offset so BOTH the
// tips and the valleys come out rounded like the reference photos.
// ------------------------------------------------------------
function star_pt(i) =
    let(ang = i * 360 / (star_points*2))
    let(r = (i % 2 == 0) ? outer_radius : inner_radius)
    [r*cos(ang), r*sin(ang)];

// parametrized so the hollow cavity can be built as its OWN valid
// star shape at smaller radii, instead of chaining another offset()
// onto the already-4x-offset rounded profile — chaining a 5th offset
// onto that produced degenerate/self-intersecting geometry on some
// arms (a Clipper numerical edge case at these tighter radii)
function star_pts_at(orad, irad) = [for (i = [0:star_points*2-1])
    let(ang = i * 360 / (star_points*2))
    let(r = (i % 2 == 0) ? orad : irad)
    [r*cos(ang), r*sin(ang)]];

module star_shape_2d(orad, irad, tipr, valr) {
    offset(r = valr) offset(r = -valr)   // rounds the inner valleys
    offset(r = -tipr) offset(r = tipr)    // rounds the outer tips
        polygon(points = star_pts_at(orad, irad));
}

module rounded_star_2d() {
    star_shape_2d(outer_radius, inner_radius, tip_round, valley_round);
}

// ------------------------------------------------------------
// Flat-faced, chamfered star body — matches the reference photos:
// true flat front/back planes (screen and medallion sit flush in
// them) with a tapered bevel edge running all around the silhouette.
// That taper is what reads as "faceted"/jewel-cut instead of an
// organic rounded blob. Built from a thick flat core slab plus two
// tapered cap layers (top and bottom), all linear_extrude — fast,
// no minkowski, no CGAL slowdowns.
// ------------------------------------------------------------
core_h = body_thickness - 2*bevel_edge;

module chamfer_cap(top = true) {
    if (top) {
        translate([0, 0, core_h/2])
            linear_extrude(height = bevel_edge, scale = bevel_scale)
                rounded_star_2d();
    } else {
        translate([0, 0, -core_h/2])
            mirror([0,0,1])
                linear_extrude(height = bevel_edge, scale = bevel_scale)
                    rounded_star_2d();
    }
}

module puffy_body() {
    union() {
        translate([0, 0, -core_h/2])
            linear_extrude(height = core_h)
                rounded_star_2d();
        chamfer_cap(true);
        chamfer_cap(false);
    }
}

// A true uniform inset of the silhouette. This is only safe because the
// centre is fat: an earlier version shrank the tip/valley radii in POLAR
// terms, which cut the valley radius by ~50% while barely touching the
// tips — the cavity's arms then hollowed out nearly the whole body and
// left just a stub of material in the middle.
module hollow_cavity() {
    translate([0, 0, -body_thickness/2 + back_wall])
        linear_extrude(height = body_thickness - back_wall - wall)
            offset(r = -wall) rounded_star_2d();
}

// ------------------------------------------------------------
// Keyring bail — a real standalone loop, not a disc with a hole.
// A tapered bridge of material flows from the star tip out to a
// rounded torus loop; a bought keyring/carabiner threads through
// the loop's hole, which runs front-to-back (same axis as the
// body's thickness) so the loop hangs face-on, exactly like the
// reference photos.
// ------------------------------------------------------------
tip0     = star_pt(0);
tip0_len = norm(tip0);
tip0_dir = tip0 / tip0_len;
bail_c   = tip0 + tip0_dir * bail_offset;

module bail_assembly(add=true) {
    if (add) {
        union() {
            // smooth tapered bridge from the tip into the loop's footprint —
            // rod matches the core slab's thickness so it fuses cleanly
            hull() {
                translate([tip0[0], tip0[1], 0]) cylinder(r = tip_round, h = core_h, center = true, $fn=24);
                translate([bail_c[0], bail_c[1], 0])
                    cylinder(r = bail_maj_r + bail_min_r, h = body_thickness*0.55, center = true, $fn=32);
            }
            // the rounded loop itself (torus, lying flat against the face)
            translate([bail_c[0], bail_c[1], 0])
                rotate_extrude($fn=48)
                    translate([bail_maj_r, 0])
                        circle(r = bail_min_r, $fn=24);
        }
    } else {
        // pass-through hole — clears the loop's inner opening
        translate([bail_c[0], bail_c[1], 0])
            cylinder(r = bail_maj_r - bail_min_r + 0.3, h = body_thickness*3, center = true, $fn=48);
    }
}

// Cosmetic-only mockup of a bought keyring hooked through the bail,
// so the assembled preview matches the reference photos. Not printed.
module keyring_mockup() {
    translate([bail_c[0], bail_c[1], 0])
        rotate([90,0,0])
            rotate_extrude($fn=48)
                translate([bail_maj_r*1.55, 0])
                    circle(r = 1.1, $fn=16);
}

// Stepped: narrow opening at the face (the glass shows through this and
// the surrounding lip retains the module), widening to a deeper ledge
// that the Φ37.5mm PCB actually drops into.
module screen_pocket() {
    top = body_thickness/2;
    translate([screen_offset_x, screen_offset_y, 0]) {
        // visible opening — cut a little proud of the face so it opens cleanly
        translate([0, 0, top - screen_lip_depth/2 + 0.5])
            cylinder(d = screen_diameter, h = screen_lip_depth + 1, center = true);
        // wider PCB ledge behind it
        translate([0, 0, top - screen_pocket_depth - 0.5])
            cylinder(d = screen_pcb_dia, h = (screen_pocket_depth - screen_lip_depth) + 1.0);
    }
    // notch clearing the module's header tab. Aimed at the 216 deg arm:
    // that one carries no other feature, and it keeps the 0 deg bail arm
    // solid since that is what takes the keyring load.
    rotate([0, 0, 216])
        translate([screen_pcb_dia/2, 0, body_thickness/2 - screen_pocket_depth/2])
            cube([ribbon_slot_radial*2, ribbon_slot_wide, screen_pocket_depth+1], center = true);
}

// polar helper — put a feature at radius r along angle a
function polar(r, a) = [r*cos(a), r*sin(a)];

camera_pos = polar(camera_r, camera_ang);

// Camera lens pocket + raised bezel ring — optional mounting space,
// see the [Camera] notes above.
module camera_pocket() {
    translate([camera_pos[0], camera_pos[1], body_thickness/2 - camera_pocket_depth/2 + 0.01])
        cylinder(d = camera_dia, h = camera_pocket_depth + 1, center = true, $fn = 48);
}

module camera_bezel() {
    ring_h = 1.4;
    top_z = body_thickness/2 - ring_h + 0.5;
    translate([camera_pos[0], camera_pos[1], top_z])
        difference() {
            cylinder(d = camera_dia + 2*camera_bezel_wall, h = ring_h, $fn = 48);
            translate([0,0,-1]) cylinder(d = camera_dia, h = ring_h + 2, $fn = 48);
        }
}

// visual-only lens mockup so the preview shows where the camera goes
module camera_lens_mockup() {
    face_z = body_thickness/2 - camera_pocket_depth + 0.35;
    translate([camera_pos[0], camera_pos[1], face_z])
        color([0.03,0.03,0.05]) cylinder(d = camera_dia - 1, h = 1, $fn = 48);
}

// DS18B20 vent — straight through so the sensor reads ambient air,
// not the electronics' own heat
module temp_vent() {
    p = polar(temp_vent_r, temp_vent_ang);
    translate([p[0], p[1], 0])
        cylinder(d = temp_vent_dia, h = body_thickness + 4, center = true, $fn = 32);
}

// MAX4466 sound port — straight through to the mic capsule
module mic_port() {
    p = polar(mic_port_r, mic_port_ang);
    translate([p[0], p[1], 0])
        cylinder(d = mic_port_dia, h = body_thickness + 4, center = true, $fn = 24);
}

// USB-C charging cutout through the valley wall
module charge_port() {
    p = polar(inner_radius, charge_port_ang);
    translate([p[0], p[1], charge_port_z])
        rotate([0, 0, charge_port_ang])
            cube([wall*6, charge_port_w, charge_port_h], center = true);
}

// single shared reference plane so the recess, the engraving, and
// the badge all agree on where the medallion floor actually is
// (previously each computed its own, and the recess ended up
// carving away the badge/engraving that were supposed to sit on it)
back_floor_z = -body_thickness/2 + back_medallion_depth;

module back_medallion_recess() {
    // cylinder whose TOP face sits exactly at back_floor_z, extending
    // well past the outer surface so it fully opens up the dish
    translate([0, 0, back_floor_z - body_thickness])
        cylinder(d = back_medallion_dia, h = body_thickness, $fn = 96);
}

// text wrapped around an arc. center_ang picks where the run is centred
// (90 = top of the disc, 270 = bottom); flip turns the letters upright
// again for the bottom run so it still reads left-to-right.
module arc_text(txt, radius, center_ang, arc, size, depth, flip=false) {
    n = len(txt);
    sweep = flip ? -arc : arc;
    for (i = [0:n-1]) {
        a = center_ang + ((n <= 1) ? 0 : (-sweep/2 + sweep * i/(n-1)));
        // `a` is the polar angle of the letter directly: 90 = top, 270 = bottom
        rotate([0, 0, a])
            translate([radius, 0, 0])
                rotate([0, 0, flip ? -90 : 90])
                    linear_extrude(height = depth)
                        text(txt[i], size=size, halign="center", valign="center",
                             font = "Liberation Sans:style=Bold");
    }
}

// engraved sunburst + curved logo text + little star badge, cut/added
// into the back medallion floor. Depth is measured from the outer
// back face inward.
// Minimal engraving, matching the reference: two small arcs of text
// hugging the rim, a fine rim groove, and nothing in the middle except
// the star mark (added separately by back_badge).
module back_decor() {
    cut = 0.5;   // must satisfy: back_medallion_depth + cut < back_wall
    z0 = back_floor_z - 0.01; // engraving cuts FROM the floor INTO the solid (+z)
    r_text = back_medallion_dia/2 * 0.80;

    // NOTE: angles are in model space. The back is viewed from the far
    // side, which flips top/bottom, so the "top" string sits at 270 here.
    translate([0,0, z0]) {
        arc_text(back_text_top,    radius = r_text, center_ang = 270, arc = 120,
                 size = back_text_size, depth = cut, flip = true);
        arc_text(back_text_bottom, radius = r_text, center_ang =  90, arc = 150,
                 size = back_text_size, depth = cut);
    }

    // fine rim groove just outside the text, like a bezel line
    translate([0,0, z0 + cut/2])
        difference() {
            cylinder(d = back_medallion_dia*0.93, h = cut, center = true, $fn = 96);
            cylinder(d = back_medallion_dia*0.93 - 0.9, h = cut + 0.4, center = true, $fn = 96);
        }
}

module back_badge() {
    // the star mark in the middle of the dish — the one hero element,
    // raised proud of the recess floor so it catches light
    // stands slightly proud of the back face so it actually catches light —
    // exactly flush reads as a flat shadow and disappears
    badge_h = back_medallion_depth + 0.4;
    s = back_medallion_dia/2 * back_badge_frac / outer_radius;
    translate([0,0, back_floor_z - badge_h])
        linear_extrude(height = badge_h)
            scale([s, s])
                rounded_star_2d();
}

module full_star() {
    // the badge is unioned AFTER the cuts: it sits on the medallion floor,
    // which is inside the recess volume, so if it were part of the input
    // union the recess would simply carve it straight back off again
    union() {
        difference() {
            union() {
                puffy_body();
                bail_assembly(add=true);
            }
            hollow_cavity();
            screen_pocket();
            camera_pocket();
            temp_vent();
            mic_port();
            charge_port();
            back_medallion_recess();
            // mirrored in X: the back face is read from the far side, which
            // reverses handedness, so un-mirrored text comes out backwards
            mirror([1,0,0]) back_decor();
            bail_assembly(add=false);
        }
        back_badge();
    }
}

// The two halves split exactly on z=0 with no overlap. They used to be cut
// with a (body_thickness/2 + 1) tall box each, which gave both halves an
// extra 0.5mm — stacked, the assembly came out 1mm too tall and the mating
// faces fought each other.
module front_half() {
    intersection() {
        full_star();
        translate([0,0,body_thickness/4]) cube([200,200,body_thickness/2], center=true);
    }
}

module back_half() {
    intersection() {
        full_star();
        translate([0,0,-body_thickness/4]) cube([200,200,body_thickness/2], center=true);
    }
}

// ------------------------------------------------------------
// Printable chrome bezel ring — sits in the screen pocket,
// frames the round display like the metal ring in the photos.
// ------------------------------------------------------------
module bezel_ring() {
    top_z = body_thickness/2 - bezel_height + 0.6;
    translate([screen_offset_x, screen_offset_y, top_z])
        difference() {
            cylinder(d = screen_diameter + 2*bezel_wall, h = bezel_height, $fn=96);
            translate([0,0,-1]) cylinder(d = screen_diameter, h = bezel_height+2, $fn=96);
        }
}

// visual-only stand-in for the actual round display module, so the
// preview render shows what the finished eye looks like. Not meant
// to be printed — your real GC9A01 module goes here instead.
// Just the empty mounting space for the real GC9A01 module — plain
// black glass, no fake eye artwork. The eye animation lives entirely
// in the firmware; this only shows where the physical display sits.
module screen_face_mockup() {
    face_z = body_thickness/2 - screen_pocket_depth + 0.4;
    translate([screen_offset_x, screen_offset_y, face_z])
        color([0.05,0.05,0.06]) cylinder(d = screen_diameter - 1, h = 1.2, $fn=96);
}

// ------------------------------------------------------------
// Pants / pocket clip — printable spring clip, PETG recommended.
// Path-based: inner mounting tab, a rounded bend, outer spring blade.
// ------------------------------------------------------------
function arc_pts(cx, cz, r, a0, a1, n=14) =
    [for (i=[0:n]) let(a = a0 + (a1-a0)*i/n) [cx + r*cos(a), cz + r*sin(a)]];

module stroke_path(pts, r) {
    for (i = [0:len(pts)-2])
        hull() {
            translate(pts[i])   circle(r=r, $fn=24);
            translate(pts[i+1]) circle(r=r, $fn=24);
        }
}

module clip_profile_2d() {
    r = clip_gap/2;
    path = concat(
        [[0, -clip_blade_len + clip_tab_len]],           // bottom of outer blade
        [[clip_gap, clip_tab_len]],                        // top of outer blade (into the bend)
        arc_pts(clip_gap - r, clip_tab_len, r, 0, 180, 14),// rounded bend over the top
        [[0, clip_tab_len]],                                // top of inner tab
        [[0, 0]]                                            // bottom of inner tab (mount point)
    );
    stroke_path(path, clip_thick/2);
}

module pants_clip() {
    difference() {
        rotate([90,0,0])
            linear_extrude(height = clip_width, center = true)
                clip_profile_2d();
        // mounting hole through the inner tab, near its bottom
        translate([0, -clip_width/2 - 1, clip_thick])
            rotate([-90,0,0])
                cylinder(d = clip_hole_dia, h = clip_width + 2, $fn=32);
    }
}

// ------------------------------------------------------------
// Printable open jump ring
// ------------------------------------------------------------
module printable_ring() {
    rotate_extrude(angle = 360 - ring_gap_deg, $fn=64)
        translate([ring_major_r,0]) circle(r=ring_tube_r, $fn=24);
}

// ------------------------------------------------------------
// OUTPUT
// ------------------------------------------------------------
if (part == "front") {
    color([0.78,0.79,0.81]) front_half();
} else if (part == "back") {
    color([0.72,0.73,0.75]) back_half();
} else if (part == "back_viewer") {
    // shows the back the way you'd actually hold and look at it:
    // physically flipped 180 about the keyring axis, camera untouched
    rotate([180,0,0]) color([0.72,0.73,0.75]) back_half();
} else if (part == "bezel") {
    color([0.85,0.86,0.88]) bezel_ring();
} else if (part == "ring") {
    color([0.85,0.86,0.88]) printable_ring();
} else if (part == "clip") {
    color([0.8,0.81,0.83]) pants_clip();
} else if (part == "preview_with_clip") {
    // everything assembled INCLUDING the printed clip+ring, in case
    // you want to see that option too
    color([0.78,0.79,0.81]) full_star();
    color([0.9,0.91,0.93])  bezel_ring();
    color([0.9,0.91,0.93])  camera_bezel();
    screen_face_mockup();
    camera_lens_mockup();
    tip = star_pt(0);
    translate([tip[0] + 6, tip[1], -2])
        rotate([0,0,180])
            color([0.8,0.81,0.83]) pants_clip();
    translate([tip[0] + 3, tip[1], 0])
        rotate([0,90,0])
            color([0.88,0.89,0.9]) printable_ring();
} else { // "preview" — just the star itself, assembled, as you'll actually build it
    color([0.78,0.79,0.81]) full_star();
    color([0.9,0.91,0.93])  bezel_ring();
    color([0.9,0.91,0.93])  camera_bezel();
    screen_face_mockup();
    camera_lens_mockup();
    color([0.85,0.86,0.9])  keyring_mockup(); // cosmetic only — buy a real one
}
