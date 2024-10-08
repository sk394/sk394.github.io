import { GlobeIcon, MailIcon, SmilePlus } from "lucide-react";

export type IconProps = React.HTMLAttributes<SVGElement>;

export const Icons = {
  email: (props: IconProps) => <MailIcon {...props} />,
  blog: (props: IconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      x="0px"
      y="0px"
      width="100"
      height="100"
      viewBox="0,0,256,256"
    >
      <g
        fill="#e333f0"
        fill-rule="nonzero"
        stroke="none"
        stroke-width="1"
        stroke-linecap="butt"
        stroke-linejoin="miter"
        stroke-miterlimit="10"
        stroke-dasharray=""
        stroke-dashoffset="0"
        font-family="none"
        font-weight="none"
        font-size="none"
        text-anchor="none"
      >
        <g transform="scale(5.12,5.12)">
          <path d="M15,3v16.9375l4,-2.03125l4,2.09375v-17zM11,6c-3.36328,0 -6,2.63672 -6,6v21c0,3.36328 2.63672,6 6,6h1v8.21875l9.375,-8.21875h18.625c3.36328,0 6,-2.63672 6,-6v-21c0,-3.36328 -2.63672,-6 -6,-6h-15v16.375l-6,7.625l-6,-7.625v-16.375zM19,20.09375l-3.71875,1.875l2.375,3.03125h2.65625l2.34375,-3zM19.125,30h24.875v3c0,2.24219 -1.75781,4 -4,4h-16.46875z"></path>
        </g>
      </g>
    </svg>
  ),
  home: (props: IconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      x="0px"
      y="0px"
      width="100"
      height="100"
      viewBox="0 0 64 64"
    >
      <path fill="#faefde" d="M55 33L31 13 7 33 7 57 55 57z"></path>
      <path
        fill="#efd8be"
        d="M31,13L7,33v1.7c0,1.1,0.9,2,2,2c0.5,0,0.9-0.2,1.3-0.5l20.1-16.7c0.4-0.3,0.9-0.3,1.3,0l20.1,16.7 c0.8,0.7,2.1,0.6,2.8-0.3c0.3-0.4,0.5-0.8,0.5-1.3V33L31,13z"
      ></path>
      <path fill="#f9dd8f" d="M7 47H55V57H7z"></path>
      <path
        fill="#cda1a7"
        d="M31.6,13.5l25.7,21.1c0.4,0.3,1.1,0.3,1.4-0.1c0.1-0.2,0.2-0.4,0.2-0.6V31c0-0.6-0.3-1.2-0.7-1.5L32.3,8 c-0.7-0.6-1.8-0.6-2.5,0l-26,21.4C3.3,29.8,3,30.3,3,31v2.9c0,0.6,0.5,1,1,1c0.2,0,0.4-0.1,0.6-0.2l25.7-21.1 C30.7,13.2,31.3,13.2,31.6,13.5z"
      ></path>
      <path
        fill="#8d6c9f"
        d="M16 50c-.6 0-1 .4-1 1v2c0 .6.4 1 1 1 .6 0 1-.4 1-1v-2C17 50.4 16.6 50 16 50zM11 50c-.6 0-1 .4-1 1v2c0 .6.4 1 1 1s1-.4 1-1v-2C12 50.4 11.6 50 11 50zM46 50c-.6 0-1 .4-1 1v2c0 .6.4 1 1 1s1-.4 1-1v-2C47 50.4 46.6 50 46 50zM51 50c-.6 0-1 .4-1 1v2c0 .6.4 1 1 1s1-.4 1-1v-2C52 50.4 51.6 50 51 50z"
      ></path>
      <path fill="#bbdef9" d="M31 20A4 4 0 1 0 31 28A4 4 0 1 0 31 20Z"></path>
      <path
        fill="#8d6c9f"
        d="M31,19c-2.8,0-5,2.2-5,5s2.2,5,5,5s5-2.2,5-5S33.8,19,31,19z M31,27.2c-1.8,0-3.2-1.4-3.2-3.2s1.4-3.2,3.2-3.2 c1.8,0,3.2,1.4,3.2,3.2v0C34.2,25.8,32.8,27.2,31,27.2z"
      ></path>
      <path fill="#ed7899" d="M25 37H37V57H25z"></path>
      <path
        fill="#8d6c9f"
        d="M33,45c-0.6,0-1,0.4-1,1v2c0,0.6,0.4,1,1,1s1-0.4,1-1v-2C34,45.4,33.6,45,33,45z"
      ></path>
      <path
        fill="#8d6c9f"
        d="M56.7,35.4c0.9,0.7,2.1,0.6,2.8-0.3c0.3-0.4,0.5-0.8,0.5-1.3V31c0-0.9-0.4-1.8-1.1-2.3l-26-21.4 c-1.1-0.9-2.7-0.9-3.8,0L18,16.4v-3.3c0-0.6-0.4-1-1-1s-1,0.4-1,1v5l-2,1.6V9.1c0-0.6-0.4-1-1-1s-1,0.4-1,1v12c0,0.1,0,0.1,0,0.2 l-8.9,7.4C2.4,29.2,2,30.1,2,31v2.9c0,0.8,0.4,1.5,1.2,1.8c0.7,0.3,1.5,0.2,2.1-0.3L6,34.8V56H3c-0.6,0-1,0.4-1,1s0.4,1,1,1h56 c0.6,0,1-0.4,1-1s-0.4-1-1-1h-3V34.8L56.7,35.4z M22,56h-2H8v-8h16v8H22z M26,56V38h10v18H26z M54,56H42h-2h-2v-8h16V56z M54,38v8 H38v-8c0-1.1-0.9-2-2-2H26c-1.1,0-2,0.9-2,2v8H8v-8v-4.8l23-18.9l23,18.9V38z M32.3,12.8c-0.7-0.6-1.8-0.6-2.5,0L4,33.9V31 c0-0.3,0.1-0.6,0.4-0.8l26-21.4c0.4-0.3,0.9-0.3,1.3,0l26,21.4c0.2,0.2,0.4,0.5,0.4,0.8v2.9L32.3,12.8z"
      ></path>
      <path
        fill="#8d6c9f"
        d="M21 50c-.6 0-1 .4-1 1v2c0 .6.4 1 1 1s1-.4 1-1v-2C22 50.4 21.6 50 21 50zM41 50c-.6 0-1 .4-1 1v2c0 .6.4 1 1 1s1-.4 1-1v-2C42 50.4 41.6 50 41 50z"
      ></path>
    </svg>
  ),
  linkedin: (props: IconProps) => (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
      <title>LinkedIn</title>
      <path
        fill="currentColor"
        d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
      />
    </svg>
  ),
  github: (props: IconProps) => (
    <svg viewBox="0 0 438.549 438.549" {...props}>
      <path
        fill="currentColor"
        d="M409.132 114.573c-19.608-33.596-46.205-60.194-79.798-79.8-33.598-19.607-70.277-29.408-110.063-29.408-39.781 0-76.472 9.804-110.063 29.408-33.596 19.605-60.192 46.204-79.8 79.8C9.803 148.168 0 184.854 0 224.63c0 47.78 13.94 90.745 41.827 128.906 27.884 38.164 63.906 64.572 108.063 79.227 5.14.954 8.945.283 11.419-1.996 2.475-2.282 3.711-5.14 3.711-8.562 0-.571-.049-5.708-.144-15.417a2549.81 2549.81 0 01-.144-25.406l-6.567 1.136c-4.187.767-9.469 1.092-15.846 1-6.374-.089-12.991-.757-19.842-1.999-6.854-1.231-13.229-4.086-19.13-8.559-5.898-4.473-10.085-10.328-12.56-17.556l-2.855-6.57c-1.903-4.374-4.899-9.233-8.992-14.559-4.093-5.331-8.232-8.945-12.419-10.848l-1.999-1.431c-1.332-.951-2.568-2.098-3.711-3.429-1.142-1.331-1.997-2.663-2.568-3.997-.572-1.335-.098-2.43 1.427-3.289 1.525-.859 4.281-1.276 8.28-1.276l5.708.853c3.807.763 8.516 3.042 14.133 6.851 5.614 3.806 10.229 8.754 13.846 14.842 4.38 7.806 9.657 13.754 15.846 17.847 6.184 4.093 12.419 6.136 18.699 6.136 6.28 0 11.704-.476 16.274-1.423 4.565-.952 8.848-2.383 12.847-4.285 1.713-12.758 6.377-22.559 13.988-29.41-10.848-1.14-20.601-2.857-29.264-5.14-8.658-2.286-17.605-5.996-26.835-11.14-9.235-5.137-16.896-11.516-22.985-19.126-6.09-7.614-11.088-17.61-14.987-29.979-3.901-12.374-5.852-26.648-5.852-42.826 0-23.035 7.52-42.637 22.557-58.817-7.044-17.318-6.379-36.732 1.997-58.24 5.52-1.715 13.706-.428 24.554 3.853 10.85 4.283 18.794 7.952 23.84 10.994 5.046 3.041 9.089 5.618 12.135 7.708 17.705-4.947 35.976-7.421 54.818-7.421s37.117 2.474 54.823 7.421l10.849-6.849c7.419-4.57 16.18-8.758 26.262-12.565 10.088-3.805 17.802-4.853 23.134-3.138 8.562 21.509 9.325 40.922 2.279 58.24 15.036 16.18 22.559 35.787 22.559 58.817 0 16.178-1.958 30.497-5.853 42.966-3.9 12.471-8.941 22.457-15.125 29.979-6.191 7.521-13.901 13.85-23.131 18.986-9.232 5.14-18.182 8.85-26.84 11.136-8.662 2.286-18.415 4.004-29.263 5.146 9.894 8.562 14.842 22.077 14.842 40.539v60.237c0 3.422 1.19 6.279 3.572 8.562 2.379 2.279 6.136 2.95 11.276 1.995 44.163-14.653 80.185-41.062 108.068-79.226 27.88-38.161 41.825-81.126 41.825-128.906-.01-39.771-9.818-76.454-29.414-110.049z"
      ></path>
    </svg>
  ),
};
