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
// ============================================================

/* [Overall size] */
star_points      = 5;      // number of lobes
outer_radius     = 27;     // mm, tip-to-center of each lobe
inner_radius     = 8;      // mm, valley depth between lobes (smaller = pointier, sharper star)
body_thickness   = 14;     // mm, total puffy thickness front+back combined
edge_round       = 3.5;    // mm, unused by current geometry, kept for reference
tip_round        = 3;      // mm, how rounded each star tip is (smaller = sleeker/sharper points)
valley_round     = 3.5;    // mm, how rounded each inner valley is (smaller = crisper neck)
wall             = 2.4;    // mm, shell wall thickness where hollowed for electronics

/* [Eye / screen] */
screen_offset_x     = -3;   // mm, shift eye left/right from body center
screen_offset_y     = 2;    // mm, shift eye up/down from body center
screen_diameter     = 33.5; // mm, fits a 1.28" GC9A01 round module (~32.4mm) with clearance
screen_pocket_depth = 6;    // mm, how deep the screen sits into the front half
bezel_wall          = 2.2;  // mm, thickness of the printable chrome bezel ring
bezel_height        = 3;    // mm
ribbon_slot_w    = 10;      // mm, width of the notch for the display's ribbon cable
ribbon_slot_h    = 4;       // mm

/* [Details] */
sensor_hole_dia  = 5;       // mm, the small "sensor dot" on the left lobe
sensor_offset_x  = -20;
sensor_offset_y  = 6;

keyring_hole_dia = 4.5;     // mm, hole for the ring, through the top tip
keyring_boss_dia = 9;       // mm, reinforced boss around the keyring hole

/* [Back medallion] */
back_medallion_dia   = 24;   // mm, shallow dish on the back
back_medallion_depth = 1.6;  // mm, keep shallow so a glued tag (or paint) sits flush
back_text            = "SRIPADBUILDS";
back_text_size       = 2.4;

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

$fn      = (quality == "fine") ? 64 : 24;
mink_fn  = (quality == "fine") ? 16 : 6;

// ------------------------------------------------------------
// Rounded/puffy star profile (2D) — double-offset so BOTH the
// tips and the valleys come out rounded like the reference photos.
// ------------------------------------------------------------
function star_pt(i) =
    let(ang = i * 360 / (star_points*2))
    let(r = (i % 2 == 0) ? outer_radius : inner_radius)
    [r*cos(ang), r*sin(ang)];

module sharp_star() {
    polygon(points = [for (i = [0:star_points*2-1]) star_pt(i)]);
}

module rounded_star_2d() {
    offset(r = valley_round) offset(r = -valley_round)   // rounds the inner valleys
    offset(r = -tip_round)   offset(r = tip_round)        // rounds the outer tips
        sharp_star();
}

// ------------------------------------------------------------
// Puffy 3D body — built as a union of hulled ellipsoids (one
// shared center lobe + one per star tip). This is the robust,
// fast way to get an organic rounded blob-star: no minkowski,
// no offset()-chain artifacts, renders in seconds.
// ------------------------------------------------------------
module ellipsoid(rxy, rz) {
    scale([1, 1, max(rz,0.05)/max(rxy,0.05)]) sphere(r = max(rxy,0.05));
}

center_lobe_rxy = inner_radius + tip_round*0.7;
body_rz         = body_thickness/2;

module puffy_body() {
    union() {
        for (i = [0:star_points-1]) {
            tip = star_pt(2*i);
            hull() {
                ellipsoid(center_lobe_rxy, body_rz);
                translate([tip[0], tip[1], 0]) ellipsoid(tip_round, body_rz);
            }
        }
    }
}

module hollow_cavity() {
    ellipsoid(max(center_lobe_rxy - wall, 1), max(body_rz - wall, 1));
}

module keyring_feature(add=true) {
    tip = star_pt(0); // an outer tip at angle 0 (rotate in your slicer so this points "up")
    translate([tip[0], tip[1], 0]) {
        if (add) cylinder(d = keyring_boss_dia, h = body_thickness, center = true, $fn=32);
        else     rotate([90,0,0]) cylinder(d = keyring_hole_dia, h = keyring_boss_dia*2, center = true, $fn=32);
    }
}

module screen_pocket() {
    translate([screen_offset_x, screen_offset_y, body_thickness/2 - screen_pocket_depth/2 + 0.01])
        cylinder(d = screen_diameter, h = screen_pocket_depth + 1, center = true);
    translate([screen_offset_x + screen_diameter/2 - 1, screen_offset_y, body_thickness/2 - screen_pocket_depth/2])
        cube([ribbon_slot_w, ribbon_slot_h, screen_pocket_depth+1], center = true);
}

module sensor_hole() {
    translate([sensor_offset_x, sensor_offset_y, 0])
        cylinder(d = sensor_hole_dia, h = body_thickness + 2, center = true);
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

// text wrapped around an arc, each letter rotated to sit tangent to the circle
module circular_text(txt, radius, arc=340, size=2.6, depth=1) {
    n = len(txt);
    for (i = [0:n-1]) {
        a = (n <= 1) ? 0 : (-arc/2 + arc * i/(n-1));
        rotate([0,0,a - 90])
            translate([radius, 0, 0])
                rotate([0,0,90])
                    linear_extrude(height = depth)
                        text(txt[i], size=size, halign="center", valign="center",
                             font = "Liberation Sans:style=Bold");
    }
}

// engraved sunburst + curved logo text + little star badge, cut/added
// into the back medallion floor. Depth is measured from the outer
// back face inward.
module back_decor() {
    cut = 0.7;
    z0 = back_floor_z - 0.01; // engraving cuts FROM the floor INTO the solid (+z)

    // sunburst grooves (engraved)
    for (a = [0:18:342])
        rotate([0,0,a])
            translate([back_medallion_dia/2*0.32, 0, z0 + cut/2])
                cube([back_medallion_dia/2*0.6, 0.9, cut], center = true);

    // curved wordmark (engraved)
    translate([0,0, z0])
        circular_text(back_text, radius = back_medallion_dia/2*0.72, arc=330,
                       size=back_text_size, depth=cut);
}

module back_badge() {
    // small raised star "logo" proud of the recess floor: sits in the
    // dish, sticking OUT toward the viewer (-z, away from the floor)
    badge_h = 0.6;
    translate([0,0, back_floor_z - badge_h])
        linear_extrude(height = badge_h)
            scale([back_medallion_dia/2*0.22/outer_radius, back_medallion_dia/2*0.22/outer_radius])
                rounded_star_2d();
}

module full_star() {
    difference() {
        union() {
            puffy_body();
            keyring_feature(add=true);
            back_badge();
        }
        hollow_cavity();
        screen_pocket();
        sensor_hole();
        back_medallion_recess();
        // mirrored: viewed from outside the back face (looking in +Z),
        // text drawn the normal way would read backwards, like an
        // un-mirrored coin die
        mirror([0,1,0]) back_decor();
        keyring_feature(add=false);
    }
}

module front_half() {
    intersection() {
        full_star();
        translate([0,0,body_thickness/4]) cube([200,200,body_thickness/2+1], center=true);
    }
}

module back_half() {
    intersection() {
        full_star();
        translate([0,0,-body_thickness/4]) cube([200,200,body_thickness/2+1], center=true);
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
module screen_face_mockup() {
    face_z = body_thickness/2 - screen_pocket_depth + 0.4;
    translate([screen_offset_x, screen_offset_y, face_z]) {
        color([0.05,0.05,0.06]) cylinder(d = screen_diameter - 1, h = 1.2, $fn=96);
        translate([-5,1.5,1.2]) color([0.85,0.95,0.85]) scale([1,0.8,1]) cylinder(d=11, h=1, $fn=48);
        translate([-5,1.5,1.3])  color([0.25,0.75,0.4])  cylinder(d=5.5, h=1, $fn=48);
        translate([6,-0.5,1.2]) color([0.85,0.95,0.85]) scale([1,0.8,1]) cylinder(d=11, h=1, $fn=48);
        translate([6,-0.5,1.3])  color([0.25,0.75,0.4])  cylinder(d=5.5, h=1, $fn=48);
    }
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
    screen_face_mockup();
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
    screen_face_mockup();
}
