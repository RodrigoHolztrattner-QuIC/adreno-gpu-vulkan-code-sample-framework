//============================================================================================================
//
//
//                  Copyright (c) 2023, Qualcomm Innovation Center, Inc. All rights reserved.
//                              SPDX-License-Identifier: BSD-3-Clause
//
//============================================================================================================

//
// Raytraced shadow compute shader.
// Uses screen depth buffer and normal buffer (from gbuffer pass) to determine if the rendered screen pixel is
// visible from the light casting position (a ray query is run from the screen world position to the light world position).
//  The output buffer is written with 1.0 if the pixel is visible from the light (unshadowed) and 0.1 otherwise (in shadow).
//

#version 460

#extension GL_ARB_separate_shader_objects : enable
//#extension GL_EXT_ray_tracing : enable
#extension GL_EXT_ray_query : enable

// Uniform buffer locations
#define SHADER_FRAG_UBO_LOCATION            0
// Texture Locations
#define SHADER_DEPTH_TEXTURE_LOC            1
#define SHADER_NORMAL_TEXTURE_LOC           2
#define SHADER_RAY_TRACE_AS_LOC             3

layout (binding = SHADER_DEPTH_TEXTURE_LOC) uniform sampler2D TexPositionDepth;
layout (binding = SHADER_NORMAL_TEXTURE_LOC) uniform sampler2D u_NormalTex;
layout (binding = SHADER_RAY_TRACE_AS_LOC, set = 0) uniform accelerationStructureEXT rayTraceAS; //set=0 required (compiler issue) https://github.com/KhronosGroup/glslang/issues/2247

// Varying's
layout (location = 0) in vec2   v_TexCoord;

// Uniforms
layout(std140, set = 0, binding = SHADER_FRAG_UBO_LOCATION) uniform FragConstantsBuff 
{
   // X: Screen Width
   // Y: Screen Height
   // Z: One Width Pixel
   // W: One Height Pixel
   vec4 ScreenSize;

   mat4 ProjectionInv;
   mat4 ViewInv;

   vec4 LightWorldPos;          // xyz = position of point light, OR position that determines length of directional probe ( dot(world position to light position, LightWorldDirection) )
   vec4 LightWorldDirection;    // xyz = normalized direction (if cDirectionalLight = true)

} FragCB;

layout(constant_id = 0) const bool cDirectionalLight = false;   // false = pointlight, true = directional

// Finally, the output color
layout (location = 0) out vec4 FragColor;


//-----------------------------------------------------------------------------
vec3 ScreenToWorld(vec2 ScreenCoord/*0-1 range*/, float Depth/*0-1*/)
//-----------------------------------------------------------------------------
{
    vec4 ClipSpacePosition = vec4((ScreenCoord * 2.0) - vec2(1.0), Depth, 1.0);
    ClipSpacePosition.y = -ClipSpacePosition.y;
    vec4 ViewSpacePosition = FragCB.ProjectionInv * ClipSpacePosition;

    // Perspective division
    ViewSpacePosition /= vec4(ViewSpacePosition.w);

    vec4 WorldSpacePosition = FragCB.ViewInv * ViewSpacePosition;
    return WorldSpacePosition.xyz;
}

//-----------------------------------------------------------------------------
void main() 
//-----------------------------------------------------------------------------
{
    vec2 LocalTexCoord = vec2(v_TexCoord.xy);
    //vec2 LocalTexCoord = vec2( FragCB.ScreenSize.z * gl_GlobalInvocationID.x, FragCB.ScreenSize.w * gl_GlobalInvocationID.y);

    // Normal (and depth) from gbuffer
    vec4 NormalWithDepth = texture( u_NormalTex, LocalTexCoord.xy );
    vec3 WorldNormal = NormalWithDepth.xyz;
    float Depth = 1.0 - NormalWithDepth.w;

    // Determine World position of pixel
    vec3 WorldPos = ScreenToWorld( LocalTexCoord, Depth );

    // Add in a little bias (along the surface normal) to account for z-depth accuracy.
    WorldPos += WorldNormal;

    // Calculate how far away the light is (and its direction)
    float LightDistance;
    vec3 DirectionToLight;
    if (cDirectionalLight)
    {
        vec3 PixelWorldToLightWorld = FragCB.LightWorldPos.xyz - WorldPos;
        DirectionToLight = -FragCB.LightWorldDirection.xyz;
        LightDistance = dot(PixelWorldToLightWorld, DirectionToLight);
    }
    else
    {
        // Point light
        LightDistance = distance(WorldPos, FragCB.LightWorldPos.xyz) - 20.0;
        DirectionToLight =  normalize(FragCB.LightWorldPos.xyz - WorldPos);
    }

    float minDistance = 0.1;
    vec3 outColor = vec3(1.0,1.0,1.0);

    // Setup the Shadow ray query (to the light).
    {
        rayQueryEXT rayQuery;
        rayQueryInitializeEXT(rayQuery, rayTraceAS, gl_RayFlagsTerminateOnFirstHitEXT, 0xFF/*cullMask*/, WorldPos, minDistance, DirectionToLight, LightDistance);

        // Traverse the query.
        while(rayQueryProceedEXT(rayQuery))
        {
        }

        // Determine if the shadow query collided.
        if(rayQueryGetIntersectionTypeEXT(rayQuery, true) != gl_RayQueryCommittedIntersectionNoneEXT)
        {
          // Got an intersection == Shadow

          float intersectionDistance = rayQueryGetIntersectionTEXT(rayQuery, true);

          outColor *= 0.1;//intersectionDistance / (LightDistance + 0.1);
        }
    }

    /* Output */
    FragColor.rgb = outColor;
    FragColor.a = 1.0;
}
